import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { activity, refreshActivity, watchActivity } from '../../lib/activity'
import { createPortal } from 'react-dom'
import { workspaceClient } from '../../lib/workspace/client.ts'
import ActivityPanel from './ActivityPanel'
import Button from '../ui/Button'

export default function ActivityHost({ live = false }: { live?: boolean }) {
  const state = useSyncExternalStore(
    activity.subscribe,
    activity.getSnapshot,
    activity.getSnapshot,
  )
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(true)
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [wide, setWide] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const host = document.querySelector<HTMLElement>('[data-activity-host]')
    const target = document.getElementById('workspace-activity-dock')
    setBody(document.body)
    setDock(target)
    try {
      setOpen(sessionStorage.getItem('atlas.activity.open') === 'true')
      setPinned(sessionStorage.getItem('atlas.activity.pinned') !== 'false')
    } catch {
      /* Storage may be unavailable. */
    }
    const observer = new ResizeObserver(() => {
      const fontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      )
      const gap = parseFloat(getComputedStyle(host!).columnGap) || 0
      setWide(
        host?.dataset.activityDockAllowed === 'true' &&
          host.clientWidth >= fontSize * (56 + 22) + gap,
      )
    })
    if (host) observer.observe(host)
    return () => observer.disconnect()
  }, [])
  const docked = pinned && wide
  useEffect(() => {
    const host = document.querySelector<HTMLElement>('[data-activity-host]')
    if (host) host.dataset.activityDocked = String(open && docked)
    if (dock) dock.hidden = !(open && docked)
    if (open && !docked && !dialog.current?.open) dialog.current?.showModal()
    else if (!open || docked) {
      const wasModal = dialog.current?.open
      dialog.current?.close()
      if (wasModal && docked) trigger.current?.focus()
    }
    return () => {
      if (host) delete host.dataset.activityDocked
      if (dock) dock.hidden = true
    }
  }, [open, docked, dock, body])
  function remember(key: string, value: boolean) {
    try {
      sessionStorage.setItem('atlas.activity.' + key, String(value))
    } catch {
      /* Optional preference. */
    }
  }
  function close() {
    setOpen(false)
    remember('open', false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  useEffect(() => {
    if (live) return watchActivity()
    activity.update({ connection: 'static' })
  }, [live])
  async function cancel(id: string) {
    try {
      await workspaceClient.command('operation.cancel', { id })
      await refreshActivity()
    } catch (error) {
      activity.notify(String(error), { tone: 'error' })
    }
  }
  const label =
    state.workspaceIssue ||
    state.recovery?.entries.some((entry) => entry.kind !== 'staging')
      ? 'Activity · needs attention'
      : state.connection === 'offline' || state.connection === 'reconnecting'
        ? 'Activity · disconnected'
        : state.current
          ? 'Activity · running'
          : 'Activity'
  const panel = (
    <>
      <div className="section-heading">
        <h2 id="activity-title" data-text-role="section-title">
          Activity
        </h2>
        <div className="action-row">
          <Button
            aria-pressed={pinned}
            onClick={() => {
              setPinned(!pinned)
              remember('pinned', !pinned)
            }}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button onClick={close}>Close</Button>
        </div>
      </div>
      {state.workspaceIssue && <p role="status">{state.workspaceIssue}</p>}
      <ActivityPanel
        state={state}
        cancel={live ? cancel : undefined}
        retry={live ? () => void refreshActivity() : undefined}
      />
    </>
  )
  return (
    <>
      <Button
        ref={trigger}
        id="job-summary"
        aria-controls={docked ? 'workspace-activity-dock' : 'activity-dialog'}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          remember('open', !open)
        }}
      >
        {label}
      </Button>
      {dock &&
        open &&
        docked &&
        createPortal(
          <section
            id="activity-panel"
            className="content-stack"
            aria-labelledby="activity-title"
          >
            {panel}
          </section>,
          dock,
        )}
      {body &&
        createPortal(
          <dialog
            id="activity-dialog"
            ref={dialog}
            className="activity-dialog"
            aria-labelledby="activity-title"
            onCancel={(event) => {
              event.preventDefault()
              close()
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) close()
            }}
          >
            {!docked && (
              <section id="activity-panel" className="content-stack">
                {panel}
              </section>
            )}
          </dialog>,
          body,
        )}
      {body &&
        createPortal(
          <div className="toast-region" aria-label="Notifications">
            {state.toasts.map((notice) => (
              <div
                className="toast content-stack"
                data-space="control"
                key={notice.id}
                onMouseEnter={() => activity.pause(notice.id)}
                onMouseLeave={(event) => {
                  if (!event.currentTarget.contains(document.activeElement))
                    activity.resume(notice.id)
                }}
                onFocusCapture={() => activity.pause(notice.id)}
                onBlurCapture={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget) &&
                    !event.currentTarget.matches(':hover')
                  )
                    activity.resume(notice.id)
                }}
              >
                <p role={notice.tone === 'error' ? 'alert' : 'status'}>
                  {notice.message}
                </p>
                <div className="action-row">
                  <Button onClick={() => activity.dismiss(notice.id)}>
                    Dismiss
                  </Button>
                  {notice.href && <a href={notice.href}>Open view</a>}
                </div>
              </div>
            ))}
          </div>,
          body,
        )}
    </>
  )
}
