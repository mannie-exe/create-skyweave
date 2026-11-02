import { requestJSON } from './http'

export type Operation = {
  id: string
  label: string
  href: string
  state: 'running' | 'succeeded' | 'failed' | 'cancelled'
  message: string
  startedAt: string
  finishedAt?: string
  job?: {
    id: string
    name: string
    cancellable: boolean
    diagnostic?: string
    state: string
  }
}
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
  connection: 'connecting' | 'online' | 'offline' | 'static'
  notices: Notice[]
  toasts: Notice[]
}

// Shared by independent React islands and ordinary DOM consumers; no React owner.
function createActivityStore() {
  let state: ActivityState = {
    current: null,
    history: [],
    connection: 'connecting',
    notices: [],
    toasts: [],
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
      const response = await requestJSON('/__atlas/jobs')
      if (response.operations) activity.accept(response.operations)
      else activity.update({ connection: 'online' })
    } catch {
      activity.update({ connection: 'offline' })
    } finally {
      refreshing = undefined
    }
  })()
  return refreshing
}
export function watchActivity() {
  void refreshActivity()
  const refresh = () => {
    if (!document.hidden) void refreshActivity()
  }
  const timer = setInterval(refresh, 1000)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
  }
}
