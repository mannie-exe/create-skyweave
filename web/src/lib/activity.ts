import { workspaceClient, type TrackedCommand } from './workspace/client.ts'
import {
  activitySnapshotSchema,
  type ActivityOperation,
  type RecoverySnapshot,
} from './workspace/contracts.ts'

export type Operation = ActivityOperation
type Notice = {
  id: string
  message: string
  tone: 'neutral' | 'error'
  href?: string
  autoDismiss: boolean
}
export type ActivityState = {
  current: Operation | null
  history: Operation[]
  connection: 'connecting' | 'online' | 'offline' | 'reconnecting' | 'static'
  notices: Notice[]
  toasts: Notice[]
  unresolved: TrackedCommand[]
  workspaceIssue?: string
  recovery?: RecoverySnapshot
  recoveryError?: string
  recoveryLoading?: boolean
}

// Shared by independent React islands and ordinary DOM consumers; no React owner.
function createActivityStore() {
  let state: ActivityState = {
    current: null,
    history: [],
    connection: 'connecting',
    notices: [],
    toasts: [],
    unresolved: [],
  }
  let session = ''
  const listeners = new Set<() => void>()
  const seen = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const update = (patch: Partial<ActivityState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const dismiss = (id: string) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    update({ toasts: state.toasts.filter((notice) => notice.id !== id) })
  }
  const pause = (id: string) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
  }
  const resume = (id: string) => {
    pause(id)
    if (state.toasts.find((notice) => notice.id === id)?.autoDismiss)
      timers.set(
        id,
        setTimeout(() => dismiss(id), 8000),
      )
  }
  const notify = (
    message: string,
    options: {
      id?: string
      tone?: Notice['tone']
      href?: string
      transient?: boolean
    } = {},
  ) => {
    const id = options.id ?? crypto.randomUUID()
    const notice: Notice = {
      id,
      message,
      tone: options.tone ?? 'neutral',
      autoDismiss: options.transient !== false && options.tone !== 'error',
      href:
        options.href?.startsWith('/') && !options.href.startsWith('//')
          ? options.href
          : undefined,
    }
    clearTimeout(timers.get(id))
    timers.delete(id)
    const toasts = [
      ...state.toasts.filter((item) => item.id !== id),
      notice,
    ].slice(-3)
    for (const old of state.toasts)
      if (!toasts.some((item) => item.id === old.id)) {
        clearTimeout(timers.get(old.id))
        timers.delete(old.id)
      }
    update({
      toasts,
      notices: [
        notice,
        ...state.notices.filter((item) => item.id !== id),
      ].slice(0, 20),
    })
    resume(id)
    return id
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    update,
    notify,
    dismiss,
    pause,
    resume,
    accept(value: {
      session: string
      current: Operation | null
      history: Operation[]
    }) {
      const first = session !== value.session
      if (first) {
        seen.clear()
        session = value.session
      }
      update({
        current: value.current,
        history: value.history,
        connection: 'online',
      })
      for (const result of [...value.history].reverse()) {
        const visibleOwner =
          typeof location !== 'undefined' &&
          !document.hidden &&
          new URL(result.href, location.href).pathname === location.pathname
        if (
          !first &&
          !seen.has(result.id) &&
          !(visibleOwner && result.state === 'succeeded')
        )
          notify(result.message, {
            id: result.id,
            tone: result.state === 'failed' ? 'error' : 'neutral',
            href: result.href,
          })
        seen.add(result.id)
      }
      for (const id of seen)
        if (!value.history.some((result) => result.id === id)) seen.delete(id)
    },
    dispose() {
      timers.forEach(clearTimeout)
      timers.clear()
      listeners.clear()
    },
  }
}

export const activity = createActivityStore()
export const notify = activity.notify
let refreshing: Promise<void> | undefined
export function refreshActivity() {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const response = await workspaceClient.query('activity.read', {})
      activity.accept(activitySnapshotSchema.parse(response))
    } catch (error) {
      activity.update({ connection: workspaceClient.getSnapshot().connection })
      activity.notify(
        error instanceof Error ? error.message : 'Activity unavailable',
        { tone: 'error' },
      )
    } finally {
      refreshing = undefined
    }
  })()
  return refreshing
}
export function watchActivity() {
  let previous: unknown
  const refresh = () => {
    const state = workspaceClient.getSnapshot()
    const snapshot = state.topics.activity?.snapshot
    const sources = state.topics.sources?.snapshot as
      { restartRequired?: boolean; monitoring?: string } | undefined
    if (snapshot && snapshot !== previous && !state.topics.activity?.stale) {
      const parsed = activitySnapshotSchema.safeParse(snapshot)
      if (parsed.success) {
        activity.accept(parsed.data)
        previous = snapshot
      }
    }
    activity.update({
      connection: state.connection,
      unresolved: state.commands.filter(
        (command) => command.state === 'unknown',
      ),
      recovery: state.recovery,
      recoveryError: state.recoveryError?.message,
      recoveryLoading: state.recoveryLoading,
      workspaceIssue: sources?.restartRequired
        ? 'Authoring code changed. Restart the Atlas server before editing or generating.'
        : sources?.monitoring === 'degraded'
          ? 'Source monitoring is unavailable. Reload saved sources before editing; restart Atlas to restore monitoring.'
          : undefined,
    })
  }
  const unsubscribe = workspaceClient.subscribe(refresh)
  refresh()
  return unsubscribe
}
