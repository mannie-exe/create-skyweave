import Button from '../ui/Button'
import Disclosure from '../ui/Disclosure'
import Feedback from '../ui/Feedback'
import type { ActivityState, Operation } from '../../lib/activity'
import { useState } from 'react'
import { workspaceClient } from '../../lib/workspace/client.ts'
import type { Operation as CompleteOperation } from '../../lib/workspace/contracts.ts'
import RecoveryPanel from './RecoveryPanel'

const labels = {
  running: 'Running',
  succeeded: 'Finished',
  failed: 'Failed',
  cancelled: 'Cancelled',
  unknown: 'Outcome unknown',
}
function Details({
  operation,
  online,
}: {
  operation: Operation
  online: boolean
}) {
  const [loaded, setLoaded] = useState<{
    key: string
    value: CompleteOperation
  } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const key = JSON.stringify([
    operation.state,
    operation.job,
    operation.stages,
    operation.finishedAt,
  ])
  const full = loaded?.key === key ? loaded.value : null
  const diagnostic = full?.job?.diagnostic ?? operation.job?.diagnostic
  async function load() {
    setLoading(true)
    setError('')
    try {
      setLoaded({
        key,
        value: await workspaceClient.query('operation.read', {
          id: operation.id,
        }),
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Details unavailable')
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      {operation.state !== 'running' &&
        operation.state !== 'succeeded' &&
        operation.stages.some((stage) => stage.committed) && (
          <Feedback tone="neutral" role="note">
            Some changes were saved. Review the stages before retrying.
          </Feedback>
        )}
      {!!operation.stages.length && (
        <Disclosure summary={<>Saved stages</>}>
          <ul>
            {(full?.stages ?? operation.stages)
              .filter((stage) => stage.committed)
              .map((stage, index) => (
                <li key={index}>{stage.name}</li>
              ))}
          </ul>
          {operation.stagesTruncated && !full && (
            <p className="scope">
              Showing {operation.stages.length} of {operation.stageCount}{' '}
              stages.
            </p>
          )}
        </Disclosure>
      )}
      {diagnostic && (
        <Disclosure summary={<>Diagnostics</>}>
          <pre>{diagnostic}</pre>
          {operation.job?.diagnosticTruncated && !full && (
            <p className="scope">Diagnostics shortened for Activity.</p>
          )}
        </Disclosure>
      )}
      {(operation.stagesTruncated || operation.job?.diagnosticTruncated) &&
        !full && (
          <div className="content-stack" data-space="control">
            <div className="action-row">
              <Button disabled={!online || loading} onClick={load}>
                {loading ? 'Loading…' : 'Load full details'}
              </Button>
            </div>
            {error && <Feedback tone="error">{error}</Feedback>}
          </div>
        )}
    </>
  )
}
function Result({
  operation,
  online,
}: {
  operation: Operation
  online: boolean
}) {
  return (
    <li className="activity-result content-stack" data-space="control">
      <div className="section-heading">
        <strong>{operation.label}</strong>
        <span data-tone={operation.state === 'failed' ? 'error' : undefined}>
          {labels[operation.state]}
        </span>
      </div>
      <p>{operation.message}</p>
      <Details operation={operation} online={online} />
      <div className="action-row scope">
        <time dateTime={operation.finishedAt ?? operation.startedAt}>
          {new Date(
            operation.finishedAt ?? operation.startedAt,
          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
        <a href={operation.href}>Open view</a>
      </div>
    </li>
  )
}
export default function ActivityPanel({
  state,
  cancel,
  retry,
}: {
  state: ActivityState
  cancel?: (id: string) => void
  retry?: () => void
}) {
  const current = state.current
  const offline =
    state.connection === 'offline' || state.connection === 'reconnecting'
  return (
    <div className="activity-panel content-stack">
      {offline && (
        <Feedback tone="error">
          Workspace unavailable. Last known results are shown; a running
          action’s outcome is not yet known.
        </Feedback>
      )}
      {offline && retry && (
        <div className="action-row">
          <Button onClick={retry}>Reconnect</Button>
        </div>
      )}
      {state.connection === 'connecting' && <p>Connecting to workspace…</p>}
      {!!state.unresolved.length && (
        <section
          className="content-stack"
          data-space="control"
          aria-label="Unconfirmed commands"
        >
          <strong>Unconfirmed commands</strong>
          <p>
            Check the saved source or output before trying these actions again.
          </p>
          <ul>
            {state.unresolved.map((command) => (
              <li key={command.commandId}>
                <code>{command.operation}</code>
                {command.error && <p>{command.error.message}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {state.connection === 'static' && (
        <p>
          Read-only snapshot. Activity requires the local workspace service.
        </p>
      )}
      <RecoveryPanel state={state} />
      {current && (
        <section
          className="content-stack"
          data-space="control"
          aria-label="Current operation"
        >
          <strong>{current.label}</strong>
          <p>
            {offline ? 'Last seen running' : 'Running'}
            {current.job ? ` · ${current.job.name}` : ''}
          </p>
          <Details
            key={current.id}
            operation={current}
            online={state.connection === 'online'}
          />
          {current.job?.cancellable && cancel && (
            <div className="action-row">
              <Button
                id="cancel-job"
                disabled={state.connection !== 'online'}
                onClick={() => cancel(current.id)}
              >
                Cancel job
              </Button>
            </div>
          )}
        </section>
      )}
      {!current && !state.history.length && <p>No recent operations.</p>}
      {!!state.history.length && (
        <ol className="activity-results">
          {state.history.map((operation) => (
            <Result
              key={operation.id}
              operation={operation}
              online={state.connection === 'online'}
            />
          ))}
        </ol>
      )}
      {!!state.notices.filter(
        (notice) =>
          !state.history.some((operation) => operation.id === notice.id),
      ).length && (
        <Disclosure summary={<>Other messages</>}>
          {state.notices
            .filter(
              (notice) =>
                !state.history.some((operation) => operation.id === notice.id),
            )
            .map((notice) => (
              <Feedback key={notice.id} tone={notice.tone} role="note">
                {notice.message}
              </Feedback>
            ))}
        </Disclosure>
      )}
      <p className="scope">
        Recent operations last for this workspace server session. Messages last
        for this page session.
      </p>
    </div>
  )
}
