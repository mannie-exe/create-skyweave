import { useState } from 'react'
import Disclosure from '../ui/Disclosure'
import Button from '../ui/Button'
import Feedback from '../ui/Feedback'
import { workspaceClient } from '../../lib/workspace/client'
import type { ActivityState } from '../../lib/activity'

export default function RecoveryPanel({ state }: { state: ActivityState }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const snapshot = state.recovery
  if (!snapshot && !state.recoveryError) return null
  if (!snapshot?.entries.length && !state.recoveryError) return null
  const online = state.connection === 'online'
  async function clean() {
    if (!snapshot) return
    setBusy(true)
    setError('')
    try {
      await workspaceClient.command('recovery.cleanup', {
        revision: snapshot.revision,
      })
      await workspaceClient.refreshRecovery()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Recovery cleanup failed.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Disclosure
      summary={
        <>
          Recovery
          {snapshot?.entries.length ? ` · ${snapshot.entries.length}` : ''}
        </>
      }
    >
      <p>
        Cleanup keeps source backups and files whose owners may still be
        running.
      </p>
      {(error || state.recoveryError) && (
        <Feedback tone="error" role="status">
          {error || state.recoveryError}
        </Feedback>
      )}
      {!!snapshot?.entries.length && (
        <ul className="content-stack" data-space="control">
          {snapshot.entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label}</strong>
              <p className="muted">
                {entry.state === 'needs-review'
                  ? 'Review saved files'
                  : entry.canClean
                    ? 'Owner stopped; cleanup available'
                    : 'Needs inspection'}
              </p>
              {!!entry.sources.length && (
                <ul>
                  {entry.sources.map((source) => (
                    <li key={source}>
                      <code>{source}</code>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {snapshot?.truncated && (
        <p>
          Showing the first 100 records. Additional cache metadata needs
          inspection.
        </p>
      )}
      <div className="action-row">
        <Button
          disabled={!online || busy || state.recoveryLoading}
          onClick={() => {
            setError('')
            void workspaceClient.refreshRecovery()
          }}
        >
          Refresh recovery
        </Button>
        <Button
          intent="destructive"
          disabled={
            !online ||
            busy ||
            state.recoveryLoading ||
            !snapshot?.entries.some((entry) => entry.canClean)
          }
          onClick={() => void clean()}
        >
          Clean interrupted files
        </Button>
      </div>
    </Disclosure>
  )
}
