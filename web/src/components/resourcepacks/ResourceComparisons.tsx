import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Feedback from '../ui/Feedback'
import ImageComparison from './ImageComparison'
import { requestJSON } from '../../lib/http'
import { observeWorkspaceChanges } from '../../lib/workspace/changes'
import type {
  comparisons as catalogue,
  approvedSelections,
} from '../../lib/resource-comparisons.mjs'
type ResourceComparison = (typeof catalogue)[number]

type Draft = { preference: string; notes: string }
type Snapshot = {
  catalogue?: ResourceComparison[]
  selections?: typeof approvedSelections
  document: {
    schema: number
    reviews: Record<string, Draft & { evidence: string }>
  }
  revision: string
  evidence: string
}
const emptyDraft: Draft = { preference: '', notes: '' }

function selection(comparisons: ResourceComparison[]) {
  const query = new URLSearchParams(window.location.search)
  const feature =
    comparisons.find((item) => item.id === query.get('feature')) ??
    comparisons[0]
  const capture =
    feature.captures.find((item) => item.id === query.get('scene')) ??
    feature.captures[0]
  const candidate =
    capture.originals
      .slice(1)
      .find((item) => item.id === query.get('candidate')) ??
    capture.originals[1]
  return { feature: feature.id, capture: capture.id, candidate: candidate.id }
}

export default function ResourceComparisons({
  comparisons: initialComparisons,
  selections: initialSelections,
  initial,
  editable,
}: {
  comparisons: ResourceComparison[]
  selections: typeof approvedSelections
  initial: Snapshot
  editable: boolean
}) {
  const [comparisons, setComparisons] = useState(initialComparisons)
  const [selections, setSelections] = useState(initialSelections)
  const [chosen, setChosen] = useState(() => selection(comparisons))
  const featureId = chosen.feature
  const feature = comparisons.find((item) => item.id === featureId)!
  const capture =
    feature.captures.find((item) => item.id === chosen.capture) ??
    feature.captures[0]
  const candidate =
    capture.originals.slice(1).find((item) => item.id === chosen.candidate) ??
    capture.originals[1]
  const [snapshot, setSnapshot] = useState(initial)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', error: false })
  const key = `${feature.run}/${featureId}`
  const saved = snapshot.document.reviews[key]
  const draft = drafts[key] ?? saved ?? emptyDraft
  const dirty = (value: Draft, original: Draft = emptyDraft) =>
    value.preference !== original.preference || value.notes !== original.notes
  const changed = dirty(draft, saved)
  const needsReview = Boolean(saved && saved.evidence !== snapshot.evidence)
  const preferences = [
    ...new Map(
      feature.captures
        .flatMap((item) => item.originals)
        .map((item) => [item.id, item]),
    ).values(),
  ]
  const anyChanged = Object.entries(drafts).some(([id, value]) =>
    dirty(value, snapshot.document.reviews[id]),
  )
  const live = useRef({ anyChanged, busy })
  live.current = { anyChanged, busy }
  useEffect(
    () =>
      observeWorkspaceChanges({
        sources: (id) =>
          ['reviews', 'review-media', 'resource-selections'].includes(id),
        changed() {
          if (live.current.anyChanged || live.current.busy) {
            setFeedback({
              message:
                'Saved reviews or evidence changed. Your drafts are preserved; reload when ready.',
              error: true,
            })
          } else void reload(false)
        },
      }),
    [],
  )
  const preferenceLabel = (value: string) =>
    feature.captures
      .flatMap((item) => item.originals)
      .find((item) => item.id === value)?.label ??
    (value === 'defer' ? 'Needs another comparison' : value || 'Undecided')

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('feature', feature.id)
    url.searchParams.set('scene', capture.id)
    url.searchParams.set('candidate', candidate.id)
    window.history.replaceState(null, '', url)
  }, [feature.id, capture.id, candidate.id])
  useEffect(() => {
    const restore = () => setChosen(selection(comparisons))
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [comparisons])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    if (anyChanged) window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyChanged])
  useEffect(() => {
    if (editable) void reload(false)
  }, [])

  async function reload(announce = true) {
    setBusy(true)
    try {
      const value: Snapshot = await requestJSON('/__atlas/resource-reviews')
      setSnapshot(value)
      if (value.catalogue?.length) {
        setComparisons(value.catalogue)
        setChosen(selection(value.catalogue))
      }
      if (value.selections) setSelections(value.selections)
      if (announce)
        setFeedback({
          message: 'Saved reviews reloaded. Your drafts are unchanged.',
          error: false,
        })
    } catch (error) {
      setFeedback({ message: String((error as Error).message), error: true })
    } finally {
      setBusy(false)
    }
  }
  function updateDraft(changes: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [key]: { preference: draft.preference, notes: draft.notes, ...changes },
    }))
  }
  async function save() {
    setBusy(true)
    setFeedback({ message: `Saving ${feature.title} review…`, error: false })
    try {
      const value = await requestJSON('/__atlas/resource-reviews/save', {
        revision: snapshot.revision,
        evidence: snapshot.evidence,
        feature: feature.id,
        review: { preference: draft.preference, notes: draft.notes },
      })
      setSnapshot(value)
      setDrafts((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      setFeedback({
        message: `${feature.title} review saved. Pack selections are unchanged.`,
        error: false,
      })
    } catch (error) {
      setFeedback({ message: (error as Error).message, error: true })
    } finally {
      setBusy(false)
    }
  }
  const reviewNotes = (
    <section
      className="content-stack comparison-notes"
      aria-labelledby="review-notes-title"
    >
      <h2 id="review-notes-title" data-text-role="section-title">
        Review notes
      </h2>
      <p data-text-role="caption">
        {editable
          ? 'Save a preference and notes for this feature. Pack selections stay separate.'
          : 'Saved review. Start pnpm dev to edit.'}
      </p>
      {saved && saved.evidence !== snapshot.evidence && (
        <Feedback>
          This review uses older captures or comparison definitions. Recheck it
          against the displayed evidence.
        </Feedback>
      )}
      {feedback.message && (
        <Feedback
          tone={feedback.error ? 'error' : 'neutral'}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.message}
        </Feedback>
      )}
      <Field id="review-preference" label="Preference">
        {(attributes) => (
          <select
            {...attributes}
            disabled={!editable || busy}
            value={draft.preference}
            onChange={(event) =>
              updateDraft({ preference: event.target.value })
            }
          >
            <option value="">Undecided</option>
            {draft.preference &&
              draft.preference !== 'defer' &&
              !preferences.some((item) => item.id === draft.preference) && (
                <option value={draft.preference} disabled>
                  {draft.preference} · no longer available
                </option>
              )}
            {preferences.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value="defer">Needs another comparison</option>
          </select>
        )}
      </Field>
      <Field id="review-notes" label="What works or needs changing?">
        {(attributes) => (
          <textarea
            {...attributes}
            disabled={!editable || busy}
            maxLength={4000}
            rows={4}
            value={draft.notes}
            onChange={(event) => updateDraft({ notes: event.target.value })}
          />
        )}
      </Field>
      {editable && (
        <div className="action-row">
          <Button
            intent="primary"
            disabled={busy || (!changed && !needsReview)}
            onClick={() => void save()}
          >
            Save review
          </Button>
          <Button
            disabled={busy || !changed}
            onClick={() =>
              setDrafts((current) => {
                const next = { ...current }
                delete next[key]
                return next
              })
            }
          >
            Revert draft
          </Button>
          <Button disabled={busy} onClick={() => void reload()}>
            Reload saved reviews
          </Button>
          <span role="status" data-text-role="caption">
            {changed
              ? 'Unsaved changes'
              : needsReview
                ? 'Review needed'
                : saved
                  ? 'Saved'
                  : 'Not reviewed'}
          </span>
        </div>
      )}
      {changed && saved && (
        <details className="disclosure">
          <summary>Saved review</summary>
          <div className="content-stack">
            <p>{preferenceLabel(saved.preference)}</p>
            <p className="comparison-saved-notes">
              {saved.notes || 'No notes'}
            </p>
          </div>
        </details>
      )}
    </section>
  )
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="resource-comparisons content-stack"
    >
      <nav aria-label="Resource pack views" className="action-row">
        <a href="/resourcepacks">Resource packs</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Visual comparisons</span>
      </nav>
      <div className="section-heading">
        <h1 data-text-role="view-title">Visual comparisons</h1>
        <span data-text-role="caption">
          {feature.date} · capture baseline: Create Sky 0.1.30
        </span>
      </div>
      <div className="comparison-workspace">
        <nav
          className="comparison-index content-stack"
          aria-label="Review features"
        >
          {comparisons.map((item) => (
            <Button
              key={item.id}
              aria-pressed={item.id === featureId}
              onClick={() => {
                setChosen({
                  feature: item.id,
                  capture: item.captures[0].id,
                  candidate: item.captures[0].originals[1].id,
                })
              }}
            >
              <span>{item.title}</span>
              <small>
                {item.captures.length} scenes
                {dirty(
                  drafts[`${item.run}/${item.id}`] ??
                    snapshot.document.reviews[`${item.run}/${item.id}`] ??
                    emptyDraft,
                  snapshot.document.reviews[`${item.run}/${item.id}`],
                )
                  ? ' · draft'
                  : snapshot.document.reviews[`${item.run}/${item.id}`]
                    ? ' · reviewed'
                    : ''}
              </small>
            </Button>
          ))}
        </nav>
        <section
          key={feature.id}
          className="comparison-evidence content-stack"
          aria-labelledby="comparison-title"
        >
          <div className="content-stack" data-space="control">
            <h2 id="comparison-title" data-text-role="section-title">
              {feature.title}
            </h2>
            <p>{feature.question}</p>
            <p className="comparison-limit">{feature.limit}</p>
          </div>
          <details className="disclosure" open>
            <summary>Approved selections</summary>
            <div className="content-stack">
              <div className="comparison-selection-table">
                <table>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Choice</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selections
                      .filter((item) => item.group === feature.id)
                      .map((item) => (
                        <tr key={item.id}>
                          <th scope="row">
                            {item.title}
                            {item.note && (
                              <small className="comparison-selection-note">
                                {item.note}
                              </small>
                            )}
                          </th>
                          <td>
                            {{
                              current: 'Current stack',
                              '3d-default': '3D Default',
                              'classic-3d': 'Classic 3D',
                              'ulticraft-models-3d': '3D Models',
                              'jacobs-workspace-plus': 'Jacob’s 3D Workspace+',
                              '3dvanilla': '3D Vanilla',
                              '3d-plants': 'Vervada’s enhanced plants',
                              'toastys-perfect-pitchers-3d-pitcher-plants':
                                'Toasty’s pitchers V3',
                              nautilus3d: 'Nautilus 3D',
                            }[item.source] ?? item.source}
                          </td>
                          <td>
                            {item.action === 'defer'
                              ? 'Deferred'
                              : item.action === 'keep'
                                ? 'Keep current'
                                : 'Selected'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
          <Field id="comparison-scene" label="Scene">
            {(attributes) => (
              <select
                {...attributes}
                value={capture.id}
                onChange={(event) =>
                  setChosen((current) => ({
                    ...current,
                    capture: event.target.value,
                  }))
                }
              >
                {feature.captures.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.caption}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="section-heading">
            <span data-text-role="label">A · Capture baseline</span>
            <Field
              id="comparison-candidate"
              label="Compare with"
              layout="inline"
            >
              {(attributes) => (
                <select
                  {...attributes}
                  value={candidate.id}
                  onChange={(event) =>
                    setChosen((current) => ({
                      ...current,
                      candidate: event.target.value,
                    }))
                  }
                >
                  {capture.originals.slice(1).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <ImageComparison
            before={{ ...capture.originals[0], label: 'A · Capture baseline' }}
            after={candidate}
            description={capture.caption}
          />
          <div className="action-row">
            <a href={capture.sheet} target="_blank" rel="noreferrer">
              All variants on one sheet
            </a>
          </div>
          {reviewNotes}
          {feature.videos.length > 0 && (
            <details
              className="disclosure"
              onToggle={(event) => {
                if (!event.currentTarget.open)
                  event.currentTarget
                    .querySelectorAll('video')
                    .forEach((video) => video.pause())
              }}
            >
              <summary>
                Closing animations · {feature.videos.length} recordings
              </summary>
              <div className="comparison-videos content-stack">
                {feature.videos.map((video) => (
                  <figure
                    className="content-stack"
                    data-space="control"
                    key={video.url}
                  >
                    <video
                      key={`${feature.id}-${video.url}`}
                      controls
                      preload="none"
                      src={video.url}
                      aria-label={video.caption}
                    />
                    <figcaption data-text-role="caption">
                      {video.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </details>
          )}
          <details className="disclosure">
            <summary>Capture context</summary>
            <div className="content-stack" data-space="control">
              <p>{feature.context}</p>
              <p>
                Archived evidence, not a live view of your client. Choosing a
                preference here does not install or generate a pack.
              </p>
            </div>
          </details>
        </section>
      </div>
    </main>
  )
}
