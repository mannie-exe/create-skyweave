import {
  bootstrapSchema,
  subscriptionSnapshotSchema,
  serverFrameSchema,
  parseClientFrame,
  recoverySnapshotSchema,
  limits,
  type Failure,
  type ClientFrame,
  type Command,
  type Scope,
  type Topic,
  type Operation,
  type ActivityOperation,
  type ServerFrame,
  type RecoverySnapshot,
} from './contracts.ts'
import { readResultReference } from './artifacts.ts'

type Connection =
  'connecting' | 'online' | 'reconnecting' | 'offline' | 'static'
type TopicState = {
  id: string
  sequence: number
  snapshot: unknown
  stale: boolean
  event?: unknown
}
export type TrackedCommand = {
  commandId: string
  operation: string
  session: string
  operationId?: string
  state: 'running' | 'unknown' | 'resolved'
  outcome?: Operation
  summary?: ActivityOperation
  error?: Failure
}
type State = {
  connection: Connection
  session: string
  scope?: Scope
  topics: Partial<Record<Topic, TopicState>>
  commands: TrackedCommand[]
  error?: Failure
  recovery?: RecoverySnapshot
  recoveryError?: Failure
  recoveryLoading?: boolean
}
type Pending = {
  resolve: (value: any) => void
  reject: (error: Error) => void
  command?: TrackedCommand
  timer: ReturnType<typeof setTimeout>
}
export class WorkspaceClientError extends Error {
  readonly failure: Failure
  readonly commandId?: string
  constructor(failure: Failure, commandId?: string) {
    super(failure.message)
    this.failure = failure
    this.commandId = commandId
  }
}
const unavailable = (message = 'Workspace connection is unavailable.') =>
  new WorkspaceClientError({
    code: 'STORAGE_UNAVAILABLE',
    message,
    recovery: 'reconnect',
  })

/** One connection per page; reconnect reads outcomes but never replays mutations. */
function createWorkspaceClient() {
  let state: State = {
    connection: 'connecting',
    session: '',
    topics: {},
    commands: [],
  }
  const listeners = new Set<() => void>(),
    pending = new Map<string, Pending>()
  let socket: WebSocket | undefined,
    bootstrap: ReturnType<typeof bootstrapSchema.parse> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined,
    handshake: ReturnType<typeof setTimeout> | undefined
  let starting: Promise<void> | undefined,
    stopped = false,
    attempts = 0
  let onlineWaiters: Array<{
    resolve: () => void
    reject: (error: Error) => void
  }> = []
  let subscribing = 0,
    earlyBytes = 0
  const refreshing = new Set<Topic>()
  const resyncing = new Set<Topic>()
  const refreshTimers = new Map<Topic, ReturnType<typeof setTimeout>>()
  let earlyEvents: Extract<ServerFrame, { type: 'event' }>[] = []
  const update = (patch: Partial<State>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const unknown = (command: TrackedCommand) =>
    new WorkspaceClientError(
      {
        code: 'OUTCOME_UNKNOWN',
        message:
          'Connection lost; review the command outcome before trying again.',
        recovery: 'inspect-outcome',
      },
      command.commandId,
    )
  function tracked(command: TrackedCommand) {
    update({
      commands: [
        ...state.commands.filter(
          (item) => item.commandId !== command.commandId,
        ),
        command,
      ],
    })
  }
  function failPending() {
    for (const request of pending.values()) {
      clearTimeout(request.timer)
      if (request.command) {
        request.command.state = 'unknown'
        tracked(request.command)
      }
      request.reject(request.command ? unknown(request.command) : unavailable())
    }
    pending.clear()
  }
  function settleWaiters(error?: Error) {
    const waiters = onlineWaiters
    onlineWaiters = []
    for (const waiter of waiters)
      if (error) waiter.reject(error)
      else waiter.resolve()
  }
  function send(frame: ClientFrame, command?: TrackedCommand): Promise<any> {
    if (!socket || socket.readyState !== WebSocket.OPEN)
      return Promise.reject(unavailable())
    if (pending.size >= limits.outstanding)
      return Promise.reject(
        new WorkspaceClientError({
          code: 'CAPACITY_REACHED',
          message: 'Too many pending requests.',
          recovery: 'after-idle',
        }),
      )
    let bytes: string
    try {
      bytes = JSON.stringify(frame)
      parseClientFrame(bytes)
    } catch {
      return Promise.reject(
        new WorkspaceClientError({
          code: 'INVALID_INPUT',
          message: 'Invalid or oversized request.',
          recovery: 'never',
        }),
      )
    }
    return new Promise((resolve, reject) => {
      const request: Pending = {
        resolve,
        reject,
        command,
        timer: setTimeout(
          () => {
            // An admission timeout is ambiguous too; terminating forces an outcome snapshot.
            socket?.close(4013, 'Request response expired')
            failPending()
          },
          command ? 15 * 60_000 : 30_000,
        ),
      }
      pending.set(frame.requestId, request)
      try {
        socket!.send(bytes)
      } catch {
        clearTimeout(request.timer)
        pending.delete(frame.requestId)
        reject(command ? unknown(command) : unavailable())
      }
    })
  }
  const envelope = () => ({
    v: 1 as const,
    requestId: crypto.randomUUID(),
    scope: bootstrap!.scope,
  })
  const read = (operation: string, payload: unknown) =>
    send({ ...envelope(), type: 'query', operation, payload })
  function refreshTopic(topic: Topic, attempt = 0) {
    if (
      topic === 'activity' ||
      refreshTimers.has(topic) ||
      refreshing.has(topic) ||
      stopped
    )
      return
    const operation =
      topic === 'sources'
        ? capabilities.includes('sources.inventory')
          ? 'sources.inventory'
          : 'map.sources.read'
        : topic === 'projections'
          ? 'projections.inventory'
          : 'environment.read'
    if (!capabilities.includes(operation)) return
    refreshTimers.set(
      topic,
      setTimeout(async () => {
        refreshTimers.delete(topic)
        const previous = state.topics[topic],
          currentSocket = socket
        if (!previous || state.connection !== 'online') return
        refreshing.add(topic)
        let again = false
        try {
          const snapshot = await read(operation, {})
          const current = state.topics[topic]
          if (
            socket !== currentSocket ||
            !current ||
            current.id !== previous.id
          )
            return
          if (current.sequence !== previous.sequence) again = true
          else
            update({
              topics: {
                ...state.topics,
                [topic]: { ...current, snapshot, stale: false },
              },
            })
        } catch (error) {
          if (
            error instanceof WorkspaceClientError &&
            error.failure.code === 'BUSY' &&
            attempt < 2
          )
            again = true
          else
            update({
              error:
                error instanceof WorkspaceClientError
                  ? error.failure
                  : unavailable().failure,
            })
        } finally {
          refreshing.delete(topic)
          if (again) refreshTopic(topic, attempt + 1)
        }
      }, 200),
    )
  }
  let capabilities: string[] = []
  let recovering: Promise<void> | undefined
  function refreshRecovery() {
    if (
      !capabilities.includes('recovery.read') ||
      state.connection !== 'online' ||
      stopped
    )
      return Promise.resolve()
    if (recovering) return recovering
    const session = state.session
    update({ recoveryLoading: true })
    recovering = (async () => {
      try {
        const recovery = recoverySnapshotSchema.parse(
          await read('recovery.read', {}),
        )
        if (state.session === session)
          update({ recovery, recoveryError: undefined })
      } catch (error) {
        if (state.session === session)
          update({
            recoveryError:
              error instanceof WorkspaceClientError
                ? error.failure
                : unavailable().failure,
            ...(error instanceof WorkspaceClientError &&
            ['NOT_FOUND', 'FORBIDDEN'].includes(error.failure.code)
              ? { recovery: undefined }
              : {}),
          })
      } finally {
        recovering = undefined
        update({ recoveryLoading: false })
        if (state.session !== session && state.connection === 'online')
          void refreshRecovery()
      }
    })()
    return recovering
  }
  async function subscribe(topics: Topic[]) {
    if (!topics.length) return
    subscribing++
    try {
      const result = subscriptionSnapshotSchema.parse(
        await send({ ...envelope(), type: 'subscribe', topics }),
      )
      const next = { ...state.topics }
      for (const sub of result.subscriptions)
        next[sub.topic] = {
          id: sub.id,
          sequence: sub.sequence,
          snapshot: sub.snapshot,
          stale: false,
        }
      update({ topics: next })
      const buffered = earlyEvents
      earlyEvents = []
      earlyBytes = 0
      for (const frame of buffered) await message(JSON.stringify(frame))
    } finally {
      subscribing--
    }
  }
  async function resync(topic: Topic, policy = false) {
    if (resyncing.has(topic)) return
    resyncing.add(topic)
    const previous = state.topics[topic]
    if (previous)
      update({
        topics: { ...state.topics, [topic]: { ...previous, stale: true } },
      })
    try {
      if (previous)
        await send({
          ...envelope(),
          type: 'unsubscribe',
          subscriptionIds: [previous.id],
        })
      await subscribe([topic])
    } catch (error) {
      if (policy) {
        const topics = { ...state.topics }
        delete topics[topic]
        update({ topics })
      }
      update({
        error:
          error instanceof WorkspaceClientError
            ? error.failure
            : unavailable().failure,
      })
    } finally {
      resyncing.delete(topic)
      if (policy) void refreshRecovery()
    }
  }
  async function reconcile() {
    for (const command of state.commands.filter(
      (item) => item.state === 'unknown',
    )) {
      try {
        const outcome: Operation = await read('command.outcome', {
          session: command.session,
          commandId: command.commandId,
        })
        tracked({
          ...command,
          state: outcome.state === 'running' ? 'running' : 'resolved',
          operationId: outcome.id,
          outcome,
        })
      } catch (error) {
        if (error instanceof WorkspaceClientError)
          tracked({ ...command, error: error.failure })
      }
    }
  }
  async function message(text: string) {
    if (new TextEncoder().encode(text).byteLength > limits.outgoing)
      throw new Error('Oversized server frame')
    const frame = serverFrameSchema.parse(JSON.parse(text))
    if (frame.type === 'welcome') {
      if (!bootstrap || (state.session && state.connection === 'online'))
        throw new Error('Unexpected welcome')
      update({
        session: frame.session,
        scope: frame.scope,
        topics: {},
        recovery: undefined,
        recoveryError: undefined,
      })
      capabilities = frame.capabilities
      const topics: Topic[] = []
      if (frame.capabilities.includes('activity.read')) topics.push('activity')
      if (
        frame.capabilities.includes('sources.inventory') ||
        frame.capabilities.includes('map.sources.read')
      )
        topics.push('sources')
      if (frame.capabilities.includes('projection.read'))
        topics.push('projections')
      if (frame.capabilities.includes('environment.read'))
        topics.push('environment')
      try {
        await subscribe(topics)
      } catch (error) {
        if (
          !(error instanceof WorkspaceClientError) ||
          !['FORBIDDEN', 'NOT_FOUND'].includes(error.failure.code)
        )
          throw error
        for (const topic of topics) {
          try {
            await subscribe([topic])
          } catch (error) {
            update({
              error:
                error instanceof WorkspaceClientError
                  ? error.failure
                  : unavailable().failure,
            })
          }
        }
      }
      clearTimeout(handshake)
      attempts = 0
      update({ connection: 'online', error: undefined })
      settleWaiters()
      void reconcile()
      void refreshRecovery()
      return
    }
    if (!state.session || frame.session !== state.session)
      throw new Error('Unexpected service session')
    if (frame.type === 'event') {
      const topic = state.topics[frame.topic]
      if (!topic || topic.id !== frame.subscriptionId) {
        if (subscribing) {
          earlyBytes += new TextEncoder().encode(text).byteLength
          if (earlyEvents.length >= 64 || earlyBytes > limits.incoming) {
            socket?.close(4013, 'Snapshot event buffer exceeded; reconnect')
            return
          }
          earlyEvents.push(frame)
        }
        return
      }
      if (topic.sequence + 1 !== frame.sequence) {
        void resync(frame.topic)
        return
      }
      let snapshot = topic.snapshot
      if (frame.topic === 'activity') {
        const incoming = (frame.payload as { operation?: ActivityOperation })
          ?.operation
        const previous = snapshot as {
          session: string
          current: ActivityOperation | null
          history: ActivityOperation[]
        }
        if (incoming) {
          if (
            incoming.state !== 'running' &&
            (['failed', 'cancelled', 'unknown'].includes(incoming.state) ||
              incoming.name === 'recovery.cleanup')
          )
            void refreshRecovery()
          snapshot =
            incoming.state === 'running'
              ? { ...previous, current: incoming }
              : {
                  ...previous,
                  current:
                    previous.current?.id === incoming.id
                      ? null
                      : previous.current,
                  history: [
                    incoming,
                    ...previous.history.filter(
                      (item) => item.id !== incoming.id,
                    ),
                  ].slice(0, limits.history),
                }
          const command = state.commands.find(
            (item) => item.commandId === incoming.commandId,
          )
          if (command)
            tracked({
              ...command,
              state: incoming.state === 'running' ? 'running' : 'resolved',
              summary: incoming,
            })
        }
      }
      update({
        topics: {
          ...state.topics,
          [frame.topic]: {
            ...topic,
            sequence: frame.sequence,
            snapshot,
            event: frame.payload,
            stale: frame.topic === 'activity' ? false : true,
          },
        },
      })
      refreshTopic(frame.topic)
      return
    }
    if (frame.type === 'resync') {
      void resync(frame.topic, frame.reason === 'policy')
      return
    }
    if (!frame.requestId) return
    const request = pending.get(frame.requestId)
    if (!request) return
    if (frame.type === 'accepted') {
      if (request.command) {
        request.command.operationId = frame.operationId
        tracked(request.command)
      }
      return
    }
    clearTimeout(request.timer)
    pending.delete(frame.requestId)
    if (frame.type === 'error') {
      if (request.command)
        tracked({
          ...request.command,
          state:
            frame.error.recovery === 'inspect-outcome' ? 'unknown' : 'resolved',
          error: frame.error,
        })
      request.reject(
        new WorkspaceClientError(frame.error, request.command?.commandId),
      )
      if (request.command && frame.error.recovery === 'inspect-outcome')
        void reconcile()
    } else {
      try {
        const deliveringSocket = socket
        const payload =
          frame.type === 'result-reference'
            ? await readResultReference(frame.reference)
            : frame.payload
        if (
          socket !== deliveringSocket ||
          !socket ||
          socket.readyState !== WebSocket.OPEN
        )
          throw unavailable()
        if (request.command) tracked({ ...request.command, state: 'resolved' })
        request.resolve(payload)
      } catch (error) {
        if (request.command) {
          tracked({ ...request.command, state: 'unknown' })
          request.reject(unknown(request.command))
          void reconcile()
        } else request.reject(error instanceof Error ? error : unavailable())
      }
    }
  }
  function reconnect() {
    if (stopped || state.connection === 'static' || retry) return
    const delay =
      Math.min(15_000, 500 * 2 ** Math.min(attempts++, 5)) *
      (0.8 + Math.random() * 0.4)
    retry = setTimeout(() => {
      retry = undefined
      void start()
    }, delay)
  }
  function start(): Promise<void> {
    if (
      stopped ||
      state.connection === 'static' ||
      (socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING))
    )
      return Promise.resolve()
    if (starting) return starting
    starting = (async () => {
      if (
        typeof document !== 'undefined' &&
        document.documentElement.dataset.workspaceDelivery === 'open-static'
      ) {
        update({ connection: 'static' })
        settleWaiters(
          unavailable('Editing requires the local workspace service.'),
        )
        return
      }
      update({ connection: state.session ? 'reconnecting' : 'connecting' })
      try {
        if (!bootstrap) {
          const response = await fetch('/__atlas/bootstrap', {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
          })
          if (response.status === 404) {
            update({ connection: 'static' })
            settleWaiters(
              unavailable('Editing requires the local workspace service.'),
            )
            return
          }
          if (!response.ok) throw unavailable()
          bootstrap = bootstrapSchema.parse(await response.json())
        }
        const url = new URL(bootstrap.socketPath, location.href)
        url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        const current = (socket = new WebSocket(url, bootstrap.protocol))
        let messageChain = Promise.resolve()
        current.addEventListener('open', () => {
          current.send(JSON.stringify({ ...envelope(), type: 'hello' }))
          handshake = setTimeout(
            () => current.close(4013, 'Snapshot response expired'),
            10_000,
          )
        })
        current.addEventListener('message', (event) => {
          // The welcome awaits a subscription reply; process correlated replies
          // independently, while keeping actual event changes ordered.
          if (typeof event.data !== 'string') {
            current.close(4003, 'JSON required')
            return
          }
          let type: string
          try {
            type = JSON.parse(event.data).type
          } catch {
            current.close(4008, 'Invalid server message')
            return
          }
          if (type === 'event')
            messageChain = messageChain
              .then(() => message(event.data))
              .catch(() => current.close(4008, 'Invalid event'))
          else
            void message(event.data).catch(() =>
              current.close(4008, 'Invalid server message'),
            )
        })
        current.addEventListener('close', () => {
          if (socket !== current) return
          clearTimeout(handshake)
          socket = undefined
          earlyEvents = []
          earlyBytes = 0
          failPending()
          update({
            connection: stopped ? 'offline' : 'reconnecting',
            topics: Object.fromEntries(
              Object.entries(state.topics).map(([key, value]) => [
                key,
                { ...value, stale: true },
              ]),
            ),
          })
          settleWaiters(unavailable())
          reconnect()
        })
      } catch (error) {
        update({
          connection: 'offline',
          error:
            error instanceof WorkspaceClientError
              ? error.failure
              : unavailable().failure,
        })
        settleWaiters(unavailable())
        reconnect()
      }
    })().finally(() => {
      starting = undefined
    })
    return starting
  }
  async function ready() {
    if (state.connection === 'online') return
    if (stopped || state.connection === 'static')
      throw unavailable('Editing requires the local workspace service.')
    const wait = new Promise<void>((resolve, reject) =>
      onlineWaiters.push({ resolve, reject }),
    )
    void start()
    await wait
  }
  return {
    async refreshRecovery() {
      await ready()
      await refreshRecovery()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      void start()
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    async query<T = any>(operation: string, payload: unknown): Promise<T> {
      await ready()
      return read(operation, payload)
    },
    async command<T = any>(operation: string, payload: unknown): Promise<T> {
      await ready()
      const retained = state.commands.filter(
        (item) => item.state !== 'resolved',
      )
      if (retained.length >= limits.receipts)
        throw new WorkspaceClientError({
          code: 'CAPACITY_REACHED',
          message: 'Review unresolved command outcomes first.',
          recovery: 'inspect-outcome',
        })
      update({
        commands: [
          ...state.commands
            .filter((item) => item.state === 'resolved')
            .slice(-limits.history),
          ...retained,
        ],
      })
      const command: TrackedCommand = {
        commandId: crypto.randomUUID(),
        session: state.session,
        operation,
        state: 'running',
      }
      const frame: Command = {
        ...envelope(),
        type: 'command',
        commandId: command.commandId,
        session: state.session,
        createdAt: new Date().toISOString(),
        operation,
        payload,
      }
      tracked(command)
      return send(frame, command).catch((error) => {
        if (
          error instanceof WorkspaceClientError &&
          error.failure.recovery !== 'inspect-outcome'
        )
          tracked({ ...command, state: 'resolved', error: error.failure })
        throw error
      })
    },
    dispose() {
      stopped = true
      clearTimeout(retry)
      clearTimeout(handshake)
      for (const timer of refreshTimers.values()) clearTimeout(timer)
      refreshTimers.clear()
      socket?.close(1000, 'Page closed')
      failPending()
      settleWaiters(unavailable())
      listeners.clear()
    },
  }
}
export const workspaceClient = createWorkspaceClient()
if (import.meta.hot) import.meta.hot.dispose(() => workspaceClient.dispose())
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => workspaceClient.dispose(), {
    once: true,
  })
