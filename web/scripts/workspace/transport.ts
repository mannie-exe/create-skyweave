import { randomUUID } from 'node:crypto'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import WebSocket, { WebSocketServer } from 'ws'
import {
  limits,
  parseClientFrame,
  serverFrameSchema,
  type ClientFrame,
  type Scope,
  type ServerFrame,
  type Topic,
} from '../../src/lib/workspace/contracts.ts'
import { WorkspaceError, failure } from './errors.ts'
import { admitDelivery, scopeKey, target, type Context } from './policy.ts'
import type { Event, Delivery, createWorkspaceService } from './service.ts'
import { createResultDelivery } from './result-delivery.ts'

type Service = ReturnType<typeof createWorkspaceService>
type Subscription = {
  id: string
  scope: Scope
  topic: Topic
  sequence: number
  paused: boolean
  pending: Map<string, Event>
  draining: boolean
}
const socketPath = '/__atlas/ws'
const socketProtocol = 'atlas.v1'
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Shared host boundary. Forwarded headers never supply authority. */
export function localRequest(
  request: IncomingMessage,
  origins: string[],
  requireOrigin = false,
) {
  if (!loopback.has(request.socket.remoteAddress ?? '')) return false
  if (
    !origins.some((origin) => {
      const expected = new URL(origin)
      return (
        expected.protocol === 'http:' &&
        request.headers.host === expected.host &&
        (!request.headers.origin || request.headers.origin === expected.origin)
      )
    })
  )
    return false
  return !requireOrigin || !!request.headers.origin
}

/** No framework, filesystem or native-job authority lives in this adapter. */
export function attachWorkspaceTransport(options: {
  server: Server
  service: Service
  scope: Scope
  origins: () => string[]
  snapshot: (context: Context, scope: Scope, topic: Topic) => Promise<Delivery>
  mode: 'open-local' | 'service'
  heartbeat?: { pingMs: number; pongMs: number }
}) {
  const { server, service } = options
  admitDelivery(options.mode, service.policy)
  const sockets = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: limits.incoming,
    handleProtocols: (offered) =>
      offered.has(socketProtocol) ? socketProtocol : false,
  })
  const sessions = new Set<() => void>()
  const results = createResultDelivery({
    can: (context, grant) => service.can(context, grant),
  })
  let disposed = false
  function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    // Vite's HMR and other upgrade listeners retain their own paths.
    if (request.url?.split('?')[0] !== socketPath) return
    if (
      disposed ||
      request.url !== socketPath ||
      !localRequest(request, options.origins(), true) ||
      request.headers['sec-websocket-protocol'] !== socketProtocol
    ) {
      socket.end(
        'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
      )
      return
    }
    sockets.handleUpgrade(request, socket, head, (connection) =>
      connect(connection),
    )
  }
  server.on('upgrade', upgrade)

  function connect(socket: WebSocket) {
    const context: Context = {
      principal: { kind: 'anonymous', id: 'local-open' },
      connectionId: randomUUID(),
    }
    const subscriptions = new Map<string, Subscription>()
    const inFlight = new Set<string>()
    let welcomed = false,
      greeting = false,
      closed = false,
      pressureSince = 0
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
    let pongTimer: ReturnType<typeof setTimeout> | undefined
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    const heartbeat = options.heartbeat ?? { pingMs: 25_000, pongMs: 10_000 }
    const close = (code: number, reason: string) => {
      if (closed) return
      socket.close(code, reason)
      cleanup()
      // A peer that stops reading must not keep the host alive indefinitely.
      const terminate = setTimeout(() => socket.terminate(), 1000)
      terminate.unref()
      socket.once('close', () => clearTimeout(terminate))
    }
    const send = (frame: ServerFrame, replaceable = false) => {
      if (closed || socket.readyState !== WebSocket.OPEN) return false
      const bytes = JSON.stringify(serverFrameSchema.parse(frame))
      if (Buffer.byteLength(bytes) > limits.outgoing) {
        close(1013, 'Result requires an artifact or a fresh snapshot')
        return false
      }
      if (socket.bufferedAmount >= 1_048_576) {
        pressureSince ||= Date.now()
        if (
          socket.bufferedAmount >= 4_194_304 ||
          Date.now() - pressureSince >= 5000 ||
          !replaceable
        ) {
          close(1013, 'Slow connection; reconnect for a snapshot')
          return false
        }
        return false
      }
      pressureSince = 0
      socket.send(bytes, (error) => {
        if (error) close(1013, 'Delivery failed; reconnect')
      })
      return true
    }
    const errorReply = (
      error: unknown,
      frame?: ClientFrame,
      operationId?: string,
    ) =>
      send({
        v: 1,
        type: 'error',
        session: service.session,
        ...(frame ? { requestId: frame.requestId } : {}),
        ...(frame?.type === 'command' ? { commandId: frame.commandId } : {}),
        ...(operationId ? { operationId } : {}),
        error: failure(error),
      })
    async function reply(
      frame: ClientFrame,
      delivery: Delivery,
      operationId?: string,
    ) {
      const correlation = {
        v: 1 as const,
        requestId: frame.requestId,
        session: service.session,
        ...(frame.type === 'command'
          ? { commandId: frame.commandId, operationId }
          : {}),
      }
      await delivery.authorize(context)
      if (
        Buffer.byteLength(JSON.stringify(delivery.payload)) + 4096 <
        limits.outgoing
      )
        return send({
          ...correlation,
          type: 'result',
          payload: delivery.payload,
        })
      const reference = await results.publish(context, frame.scope, delivery)
      return send({ ...correlation, type: 'result-reference', reference })
    }
    const reset = (sub: Subscription, reason: 'policy' | 'capacity') => {
      subscriptions.delete(sub.id)
      send({
        v: 1,
        type: 'resync',
        session: service.session,
        scope: sub.scope,
        topic: sub.topic,
        reason,
      })
    }
    async function drain(sub: Subscription) {
      if (closed || sub.paused || sub.draining || !subscriptions.has(sub.id))
        return
      sub.draining = true
      try {
        for (const [key, event] of sub.pending) {
          const visible = await service.eventFor(context, event)
          if (!subscriptions.has(sub.id) || closed) return
          if (!visible) {
            reset(sub, 'policy')
            return
          }
          const payload = visible.payload as { operation?: { state?: string } }
          const replaceable =
            payload?.operation?.state === 'running' ||
            event.topic !== 'activity'
          const delivered = send(
            {
              v: 1,
              type: 'event',
              session: service.session,
              subscriptionId: sub.id,
              scope: sub.scope,
              topic: sub.topic,
              sequence: sub.sequence + 1,
              payload: visible.payload,
            },
            replaceable,
          )
          if (!delivered) {
            scheduleFlush()
            return
          }
          sub.sequence++
          // An event may have replaced this key while authorization awaited.
          if (sub.pending.get(key) === event) sub.pending.delete(key)
        }
      } catch {
        reset(sub, 'policy')
      } finally {
        sub.draining = false
      }
    }
    function scheduleFlush() {
      if (flushTimer || closed) return
      flushTimer = setTimeout(() => {
        flushTimer = undefined
        for (const sub of subscriptions.values()) void drain(sub)
      }, 100)
      flushTimer.unref()
    }
    const unlisten = service.onEvent((event) => {
      for (const sub of subscriptions.values()) {
        if (
          scopeKey(sub.scope) !== scopeKey(event.scope) ||
          sub.topic !== event.topic
        )
          continue
        const operation = (
          event.payload as { operation?: { id?: string; state?: string } }
        )?.operation
        const changed = (event.payload as { sources?: string[] })?.sources
        const key =
          operation?.id ??
          (Array.isArray(changed) ? changed.join('\u0000') : event.topic)
        // Terminal outcomes replace earlier progress, never the reverse.
        sub.pending.set(key, event)
        if (sub.pending.size > 64) {
          reset(sub, 'capacity')
          continue
        }
        if (operation?.state && operation.state !== 'running' && !sub.paused)
          void drain(sub)
        else scheduleFlush()
      }
    })
    function ping() {
      if (closed) return
      socket.ping()
      pongTimer = setTimeout(() => {
        socket.terminate()
        cleanup()
      }, heartbeat.pongMs)
      pongTimer.unref()
    }
    socket.on('pong', () => {
      clearTimeout(pongTimer)
      clearTimeout(heartbeatTimer)
      if (!closed) {
        heartbeatTimer = setTimeout(ping, heartbeat.pingMs)
        heartbeatTimer.unref()
      }
    })
    heartbeatTimer = setTimeout(ping, heartbeat.pingMs)
    heartbeatTimer.unref()

    async function handle(frame: ClientFrame) {
      if (frame.type === 'hello') {
        if (welcomed || greeting)
          throw new WorkspaceError('INVALID_INPUT', 'Already introduced')
        greeting = true
        try {
          service.resolve(context, frame.scope)
          if (
            !(await service.can(context, {
              action: 'pack.read',
              target: target(frame.scope, 'pack', frame.scope.packId),
            }))
          )
            throw new WorkspaceError('NOT_FOUND', 'Workspace is unavailable')
          welcomed = send({
            v: 1,
            type: 'welcome',
            requestId: frame.requestId,
            session: service.session,
            serverTime: new Date().toISOString(),
            protocol: socketProtocol,
            scope: frame.scope,
            capabilities: service.definitions().map((d) => d.name),
            cursor: 0,
          })
        } finally {
          greeting = false
        }
        return
      }
      if (!welcomed)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Introduce the connection first',
        )
      service.resolve(context, frame.scope)
      if (frame.type === 'query') {
        const delivery = await service.queryDelivery(
          context,
          frame.scope,
          frame.operation,
          frame.payload,
        )
        await reply(frame, delivery)
      } else if (frame.type === 'command') {
        const admitted = await service.submit(context, frame)
        send({
          v: 1,
          type: 'accepted',
          requestId: frame.requestId,
          commandId: frame.commandId,
          operationId: admitted.operation.id,
          session: service.session,
        })
        const outcome = await admitted.outcome
        if (outcome.error)
          errorReply(
            new WorkspaceError(
              outcome.error.code,
              outcome.error.message,
              outcome.error.recovery,
              outcome.error.details,
            ),
            frame,
            outcome.operation.id,
          )
        else
          try {
            await reply(
              frame,
              { payload: outcome.payload, authorize: admitted.authorize },
              outcome.operation.id,
            )
          } catch (error) {
            errorReply(
              new WorkspaceError(
                'OUTCOME_UNKNOWN',
                'The command finished, but its result could not be delivered. Review its outcome.',
                'inspect-outcome',
              ),
              frame,
              outcome.operation.id,
            )
          }
      } else if (frame.type === 'subscribe') {
        const requested = [...new Set(frame.topics)]
        if (subscriptions.size + requested.length > limits.subscriptions)
          throw new WorkspaceError(
            'CAPACITY_REACHED',
            'Subscription capacity reached',
          )
        if (
          requested.some((topic) =>
            [...subscriptions.values()].some(
              (sub) =>
                sub.topic === topic &&
                scopeKey(sub.scope) === scopeKey(frame.scope),
            ),
          )
        )
          throw new WorkspaceError(
            'INVALID_INPUT',
            'This topic is already subscribed',
          )
        const added: Subscription[] = []
        try {
          for (const topic of requested) {
            const sub: Subscription = {
              id: randomUUID(),
              scope: frame.scope,
              topic,
              sequence: 0,
              paused: true,
              pending: new Map(),
              draining: false,
            }
            subscriptions.set(sub.id, sub)
            added.push(sub)
          }
          const snapshots = []
          const deliveries: Delivery[] = []
          for (const sub of added) {
            const delivery = await options.snapshot(
              context,
              sub.scope,
              sub.topic,
            )
            if (!subscriptions.has(sub.id))
              throw new WorkspaceError(
                'CAPACITY_REACHED',
                'Snapshot changed; subscribe again',
                'after-refresh',
              )
            deliveries.push(delivery)
            snapshots.push({
              id: sub.id,
              topic: sub.topic,
              sequence: 0,
              snapshot: delivery.payload,
            })
          }
          if (
            await reply(frame, {
              payload: { subscriptions: snapshots },
              authorize: async (actor) => {
                for (const delivery of deliveries)
                  await delivery.authorize(actor)
              },
            })
          )
            for (const sub of added) {
              sub.paused = false
              void drain(sub)
            }
        } catch (error) {
          for (const sub of added) subscriptions.delete(sub.id)
          throw error
        }
      } else {
        for (const id of frame.subscriptionIds) {
          const sub = subscriptions.get(id)
          if (sub && scopeKey(sub.scope) !== scopeKey(frame.scope))
            throw new WorkspaceError('NOT_FOUND', 'Subscription is unavailable')
          subscriptions.delete(id)
        }
        send({
          v: 1,
          type: 'result',
          requestId: frame.requestId,
          session: service.session,
          payload: { unsubscribed: true },
        })
      }
    }
    socket.on('message', (bytes, binary) => {
      if (binary) {
        close(1003, 'JSON text required')
        return
      }
      let frame: ClientFrame
      try {
        frame = parseClientFrame(bytes.toString('utf8'))
      } catch {
        errorReply(
          new WorkspaceError('INVALID_INPUT', 'Invalid message envelope'),
        )
        close(1008, 'Invalid message')
        return
      }
      if (inFlight.has(frame.requestId)) {
        errorReply(
          new WorkspaceError('INVALID_INPUT', 'Request ID is already pending'),
          frame,
        )
        return
      }
      if (inFlight.size >= limits.outstanding) {
        errorReply(
          new WorkspaceError('CAPACITY_REACHED', 'Request capacity reached'),
          frame,
        )
        return
      }
      inFlight.add(frame.requestId)
      void handle(frame)
        .catch((error) => errorReply(error, frame))
        .finally(() => inFlight.delete(frame.requestId))
    })
    socket.on('error', () => cleanup())
    socket.on('close', () => cleanup())
    function cleanup() {
      if (closed) return
      closed = true
      clearTimeout(heartbeatTimer)
      clearTimeout(pongTimer)
      clearTimeout(flushTimer)
      subscriptions.clear()
      unlisten()
      sessions.delete(stop)
    }
    const stop = () => close(1001, 'Workspace stopped')
    sessions.add(stop)
  }
  async function http(request: IncomingMessage, response: ServerResponse) {
    if (request.url?.split('?')[0].includes('/results/')) {
      if (!localRequest(request, options.origins())) {
        response.writeHead(403).end()
        return true
      }
      return results.http(
        {
          principal: { kind: 'anonymous', id: 'local-open' },
          connectionId: randomUUID(),
        },
        request,
        response,
      )
    }
    if (request.url !== '/__atlas/bootstrap') return false
    if (!localRequest(request, options.origins())) {
      response.writeHead(403).end()
      return true
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return true
    }
    const context: Context = {
      principal: { kind: 'anonymous', id: 'local-open' },
      connectionId: randomUUID(),
    }
    const allowed = await service.can(context, {
      action: 'pack.read',
      target: target(options.scope, 'pack', options.scope.packId),
    })
    if (!allowed) {
      response.writeHead(404).end()
      return true
    }
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(
      request.method === 'HEAD'
        ? undefined
        : JSON.stringify({
            mode: options.mode,
            scope: options.scope,
            protocol: socketProtocol,
            socketPath,
          }),
    )
    return true
  }
  return {
    http,
    dispose() {
      if (disposed) return
      disposed = true
      server.off('upgrade', upgrade)
      for (const stop of [...sessions]) stop()
      sockets.close()
      results.dispose()
    },
  }
}
