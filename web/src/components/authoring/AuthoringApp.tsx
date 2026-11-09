import ViewTabs from '../ui/ViewTabs'
import EditorActions from '../ui/EditorActions'
import Feedback from '../ui/Feedback'
import Button from '../ui/Button'
import Disclosure from '../ui/Disclosure'
import { useEffect, useRef, useState } from 'react'
import { requestJSON } from '../../lib/http'
import { notify } from '../../lib/activity'
import { authoringViews } from '../../lib/authoring-navigation'
import { encode, assertQuestShape } from '../../lib/quests.mjs'
import Entries from './quests/Entries'
import SharedText from './quests/SharedText'
import Localization, { type Documents } from './quests/Localization'
import JsonEditor from './quests/JsonEditor'
import { DraftContext } from './quests/Drafts'
import { workspaceClient } from '../../lib/workspace/client'
import { observeWorkspaceChanges } from '../../lib/workspace/changes'
import { readJSONArtifact } from '../../lib/workspace/artifacts'
type Snapshot = {
  files: Record<string, { text: string; revision: string }>
  revision: string
  generation?: { changed: string[]; removed?: string[]; outputs: number }
  generationError?: string
}
const request = (path = '', body?: unknown) =>
  requestJSON('/__atlas/authoring' + path, body)
export default function AuthoringApp() {
  const [snapshot, setSnapshot] = useState<Snapshot>(),
    [documents, setDocuments] = useState<Documents>({}),
    [view, setView] = useState('entries'),
    [locale, setLocale] = useState('en_us'),
    [entryId, setEntryId] = useState(''),
    [sharedId, setSharedId] = useState('suggested_project'),
    [search, setSearch] = useState(''),
    [stringsKey, setStringsKey] = useState(0)
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState('Loading source…'),
    [statusError, setStatusError] = useState(false),
    [raw, setRaw] = useState<Record<string, string>>({}),
    [source, setSource] = useState('quests/book.json'),
    [audit, setAudit] = useState<any>(),
    [category, setCategory] = useState(''),
    [refreshRequired, setRefreshRequired] = useState(false)
  const changes: Record<string, string | null> = {}
  if (snapshot) {
    for (const [name, value] of Object.entries(documents)) {
      if (
        !snapshot.files[name] ||
        JSON.stringify(value) !==
          JSON.stringify(JSON.parse(snapshot.files[name].text))
      )
        changes[name] = encode(value)
    }
    for (const name of Object.keys(snapshot.files))
      if (!Object.hasOwn(documents, name)) changes[name] = null
  }
  const dirty = Object.keys(changes).length > 0,
    unapplied = Object.keys(raw).length > 0,
    inQuests = ['entries', 'shared', 'strings'].includes(view)
  const questScope =
    inQuests || (view === 'source' && source.startsWith('quests/'))
  const saveNames = Object.keys(changes).filter((name) =>
    questScope ? name.startsWith('quests/') : name === source,
  )
  const generatedCount =
    (snapshot?.generation?.changed.length || 0) +
    (snapshot?.generation?.removed?.length || 0)
  const current = useRef({ dirty, unapplied, busy, snapshot })
  current.current = { dirty, unapplied, busy, snapshot }
  function applySource(value: Snapshot) {
    const documents = Object.fromEntries(
      Object.entries(value.files).map(([name, file]) => {
        try {
          return [name, JSON.parse(file.text)]
        } catch {
          throw new Error(`${name}: invalid JSON. The current view was kept.`)
        }
      }),
    )
    assertQuestShape(documents)
    setSnapshot(value)
    setDocuments(documents)
    setRaw({})
    setRefreshRequired(false)
  }
  async function load() {
    const value = await request()
    applySource(value)
    setStatus('Source loaded')
  }
  async function action(
    work: () => Promise<void>,
    pending = 'Loading source…',
  ) {
    setBusy(true)
    setStatusError(false)
    setStatus(pending)
    try {
      await work()
    } catch (e) {
      setStatusError(true)
      setStatus(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void action(load)
    const url = new URL(location.href)
    const initial = url.searchParams.get('view')
    if (initial === 'audit' || initial === 'source') setView(initial)
  }, [])
  useEffect(
    () =>
      observeWorkspaceChanges({
        sources: (id) =>
          id.startsWith('quests/') ||
          id.startsWith('changes/') ||
          id.startsWith('input:pack/overrides/'),
        projections: ['quests-preview'],
        changed(change) {
          if (!current.current.snapshot) return
          if (
            change.topic === 'sources' &&
            change.ids.every((id) => id.startsWith('input:pack/overrides/'))
          ) {
            setAudit(undefined)
            setStatus(
              'Configuration changed. Check files to refresh the audit.',
            )
            return
          }
          const conflict = () => {
            setRefreshRequired(true)
            setStatusError(true)
            setStatus(
              'Saved source changed. Your draft is preserved; reload when ready.',
            )
          }
          if (
            current.current.dirty ||
            current.current.unapplied ||
            current.current.busy
          ) {
            conflict()
            return
          }
          const before = current.current.snapshot
          void action(async () => {
            const next = await workspaceClient.query('quests.read', {})
            const generation =
              next.preview.state === 'current'
                ? await readJSONArtifact(next.preview.artifact)
                : undefined
            if (
              current.current.dirty ||
              current.current.unapplied ||
              current.current.snapshot !== before
            ) {
              conflict()
              return
            }
            applySource({
              ...next,
              generation,
              ...(generation
                ? {}
                : {
                    generationError:
                      'Saved source changed. Review generation is out of date.',
                  }),
            })
            setStatus('Saved source refreshed')
          }, 'Refreshing saved source…')
        },
      }),
    [],
  )
  useEffect(() => {
    if (!dirty && !unapplied) return
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    const navigate = (e: MouseEvent) => {
      if (
        (e.target as Element).closest('a[href]') &&
        !confirm('Leave with unsaved authoring changes?')
      )
        e.preventDefault()
    }
    window.addEventListener('beforeunload', before)
    document.addEventListener('click', navigate)
    return () => {
      window.removeEventListener('beforeunload', before)
      document.removeEventListener('click', navigate)
    }
  }, [dirty, unapplied])
  function openStrings(key: string) {
    setSearch(key)
    setStringsKey((n) => n + 1)
    setView('strings')
  }
  const tab = (id: string, title: string, selected = view === id) => (
    <Button
      key={id}
      type="button"
      aria-pressed={selected}
      disabled={busy}
      onClick={() => setView(id)}
    >
      {title}
    </Button>
  )
  async function save() {
    const selected = Object.fromEntries(
      saveNames.map((name) => [name, changes[name]]),
    )
    const saved = await request('/save', {
      changes: selected,
      revision: snapshot!.revision,
    })
    // Acknowledged writes stay saved even if reading the resulting view fails.
    const committed = { ...snapshot!.files }
    for (const [name, text] of Object.entries(selected)) {
      if (text === null) delete committed[name]
      else committed[name] = { text, revision: saved.revision }
    }
    setSnapshot({ ...snapshot!, files: committed, revision: saved.revision })
    await refreshAfterWrite(
      questScope
        ? 'Source saved. Generate to update FTB Quests files.'
        : 'Source saved.',
      async () => {
        // Retain drafts outside this view when refreshing saved revisions.
        const next = await request(),
          remaining = Object.fromEntries(
            Object.entries(changes).filter(
              ([name]) => !saveNames.includes(name),
            ),
          )
        const values: Documents = Object.fromEntries(
          Object.entries(next.files).map(([name, file]: any) => [
            name,
            JSON.parse(file.text),
          ]),
        )
        for (const [name, text] of Object.entries(remaining)) {
          if (text === null) delete values[name]
          else values[name] = JSON.parse(text)
        }
        setSnapshot(next)
        setDocuments(values)
      },
    )
  }
  async function refreshAfterWrite(
    success: string,
    refresh: () => Promise<void>,
  ) {
    try {
      await refresh()
      setRefreshRequired(false)
      setStatus(success)
    } catch (error) {
      setRefreshRequired(true)
      setStatusError(true)
      const message = `${success} View refresh failed: ${error instanceof Error ? error.message : String(error)} Reload source to check generated files; current drafts are retained.`
      setStatus(message)
      notify(message, { tone: 'error' })
    }
  }
  const heading =
    view === 'entries'
      ? 'Quests'
      : view === 'shared'
        ? 'Shared text'
        : view === 'strings'
          ? 'Localization'
          : view === 'audit'
            ? 'Config audit'
            : 'Source JSON'
  return (
    <DraftContext
      value={{
        drafts: raw,
        setDraft: (id, text) =>
          setRaw((previous) => {
            const next = { ...previous }
            if (text === undefined) delete next[id]
            else next[id] = text
            return next
          }),
      }}
    >
      <ViewTabs label="Authoring views">
        {authoringViews.map((item) =>
          item.id === 'models' ? (
            <a key={item.id} href={item.href}>
              {item.label}
            </a>
          ) : (
            tab(
              item.id,
              item.label,
              item.id === 'entries' ? inQuests : view === item.id,
            )
          ),
        )}
      </ViewTabs>
      <main
        id="main-content"
        tabIndex={-1}
        className="authoring content-stack"
        data-space="section"
      >
        {inQuests && (
          <nav className="action-row quest-tabs" aria-label="Quest tools">
            {tab('entries', 'Quests')}
            {tab('shared', 'Shared text')}
            {tab('strings', 'Localization')}
          </nav>
        )}
        <section
          className="content-stack"
          data-space="section"
          aria-label={heading}
        >
          <header className="section-heading">
            <h1 data-text-role="item-title">{heading}</h1>
            <EditorActions
              status={
                <>
                  {snapshot && (
                    <p className="scope">
                      {dirty || unapplied
                        ? 'Draft · unsaved changes'
                        : 'Source · saved'}
                      {questScope && (
                        <>
                          {' · '}
                          {refreshRequired
                            ? 'FTB Quests files · status unavailable'
                            : generatedCount
                              ? 'FTB Quests files · update needed'
                              : 'FTB Quests files · match saved source'}
                        </>
                      )}
                    </p>
                  )}
                  <Feedback
                    role="status"
                    tone={statusError ? 'error' : 'neutral'}
                  >
                    {status}
                  </Feedback>
                </>
              }
            >
              <Button
                intent={dirty || unapplied ? 'destructive' : 'default'}
                disabled={busy}
                onClick={() => {
                  if (
                    (dirty || unapplied) &&
                    !confirm('Discard all unsaved source and field edits?')
                  )
                    return
                  void action(load)
                }}
              >
                Reload source
              </Button>
              {view === 'audit' ? (
                <Button
                  disabled={busy || !snapshot}
                  onClick={() =>
                    void action(async () => {
                      setAudit(await request('/audit'))
                      setStatus('Config files checked')
                    }, 'Checking config files…')
                  }
                >
                  Check files
                </Button>
              ) : (
                <Button
                  intent="primary"
                  disabled={
                    busy || !saveNames.length || unapplied || refreshRequired
                  }
                  onClick={() => void action(save, 'Saving source…')}
                >
                  {questScope ? 'Save quests' : 'Save source'}
                </Button>
              )}
              {inQuests && (
                <Button
                  disabled={
                    busy ||
                    dirty ||
                    unapplied ||
                    !snapshot ||
                    !generatedCount ||
                    refreshRequired
                  }
                  onClick={() =>
                    void action(async () => {
                      const result = await request('/generate', {
                        revision: snapshot!.revision,
                      })
                      await refreshAfterWrite(
                        result.output + '. Instances were not changed.',
                        load,
                      )
                    }, 'Generating FTB Quests files…')
                  }
                >
                  Generate FTB Quests files
                </Button>
              )}
            </EditorActions>
          </header>
          <div className="content-stack" data-space="control">
            {(dirty || unapplied) && (
              <p className="scope">
                {Object.keys(changes).length} changed source files
                {unapplied
                  ? `; ${Object.keys(raw).length} field edits to apply or discard before saving`
                  : ''}
                . Drafts stay with you between views. Save quests includes all
                quest drafts.
              </p>
            )}
          </div>
          {unapplied && (
            <Disclosure summary={<>Unapplied field edits</>}>
              <ul>
                {Object.keys(raw).map((id) => (
                  <li key={id}>
                    <div className="action-row">
                      <code>{id}</code>
                      <Button
                        intent="destructive"
                        onClick={() => {
                          if (!confirm(`Discard unapplied edit for ${id}?`))
                            return
                          setRaw((previous) => {
                            const next = { ...previous }
                            delete next[id]
                            return next
                          })
                        }}
                      >
                        Discard edit
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          {snapshot?.generationError && inQuests && (
            <Feedback tone="error">
              Generation review unavailable. {snapshot.generationError}
            </Feedback>
          )}
          {snapshot?.generation && inQuests && !refreshRequired && (
            <Disclosure
              className="generation-review"
              summary={
                <>
                  {dirty
                    ? 'Unsaved draft; comparison uses saved source'
                    : generatedCount
                      ? `${generatedCount} pack files waiting for generation`
                      : 'Pack files match saved source'}
                </>
              }
            >
              <p className="scope">
                {snapshot.generation.outputs} outputs. Generation applies listed
                writes and deletions to the pack. Resource JAR building and
                instance installation are separate.
              </p>
              <ul>
                {snapshot.generation.changed.map((p) => (
                  <li key={p}>Write {p}</li>
                ))}
                {snapshot.generation.removed?.map((p) => (
                  <li key={p}>Delete {p}</li>
                ))}
              </ul>
            </Disclosure>
          )}
          {snapshot && (
            <fieldset className="workbench-fields" disabled={busy}>
              {view === 'entries' && (
                <Entries
                  documents={documents}
                  onChange={setDocuments}
                  locale={locale}
                  setLocale={setLocale}
                  id={entryId}
                  setId={setEntryId}
                  openStrings={openStrings}
                />
              )}
              {view === 'shared' && (
                <SharedText
                  id={sharedId}
                  setId={setSharedId}
                  documents={documents}
                  onChange={setDocuments}
                  locale={locale}
                  openStrings={openStrings}
                  openEntry={(id) => {
                    setEntryId(id)
                    setView('entries')
                  }}
                />
              )}
              {view === 'strings' && (
                <Localization
                  key={stringsKey}
                  documents={documents}
                  onChange={setDocuments}
                  locale={locale}
                  setLocale={setLocale}
                  initialSearch={search}
                />
              )}
              {view === 'source' && (
                <section className="content-stack">
                  <label>
                    Source file
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      {Object.keys(documents).map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <p className="scope">
                    Advanced source editing. Quest structure and locale
                    references are validated together on save.
                  </p>
                  <JsonEditor
                    id={source}
                    value={documents[source]}
                    label="Source JSON"
                    onApply={(value) => {
                      if (
                        !value ||
                        typeof value !== 'object' ||
                        Array.isArray(value)
                      )
                        throw new Error('Source must be a JSON object.')
                      const next = { ...documents, [source]: value }
                      if (source.startsWith('quests/')) assertQuestShape(next)
                      setDocuments(next)
                    }}
                  />
                </section>
              )}
              {view === 'audit' && (
                <section className="content-stack">
                  <label>
                    Category
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">All categories</option>
                      {Object.keys(documents)
                        .filter((n) => n.startsWith('changes/'))
                        .map((n) => (
                          <option key={n} value={n.slice(8, -5)}>
                            {n.slice(8, -5)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {audit ? (
                    <>
                      <p>
                        {audit.records.length} files;{' '}
                        {
                          audit.records.filter(
                            (r: any) => r.status !== 'matched',
                          ).length
                        }{' '}
                        changed or missing. Unregistered:{' '}
                        {audit.unregistered?.length || 0}.
                      </p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>File</th>
                              <th>Status</th>
                              <th>Review</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {audit.records
                              .filter(
                                (r: any) =>
                                  !category || r.category === category,
                              )
                              .map((r: any) => (
                                <tr key={r.path}>
                                  <td>{r.path}</td>
                                  <td>{r.status}</td>
                                  <td>{r.review}</td>
                                  <td>
                                    {r.reason} {r.reference}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      {category && (
                        <p>{documents[`changes/${category}.json`]?.note}</p>
                      )}
                      {audit.unregistered?.length > 0 && (
                        <Disclosure summary={<>Unregistered files</>}>
                          <ul>
                            {audit.unregistered.map((p: string) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </Disclosure>
                      )}
                    </>
                  ) : (
                    <p>
                      Check files to compare the configuration register with the
                      pack.
                    </p>
                  )}
                </section>
              )}
            </fieldset>
          )}
        </section>
      </main>
    </DraftContext>
  )
}
