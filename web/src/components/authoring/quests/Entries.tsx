import { useState } from 'react'
import Field from '../../ui/Field'
import Workbench from '../../ui/Workbench'
import Feedback from '../../ui/Feedback'
import Button from '../../ui/Button'
import Disclosure from '../../ui/Disclosure'
import ViewTabs from '../../ui/ViewTabs'
import { localeLabel } from '../../../lib/locales'
import {
  chapterList,
  chapterPath,
  questList,
  localeText,
  createQuest,
  removeQuest,
  updateQuest,
  createChapter,
  removeChapter,
  updateChapter,
  createGroup,
  removeGroup,
  paragraphs,
} from '../../../lib/quests.mjs'
import ObjectText, { type Documents } from './ObjectText'
import JsonEditor from './JsonEditor'
import { TaskEditor, RewardEditor, Choice, Text, Count } from './Rows'
import ChapterLayout from './ChapterLayout'
const omit = (value: any, key: string) => {
  const next = { ...value }
  delete next[key]
  return next
}
export default function Entries({
  documents,
  onChange,
  locale,
  setLocale,
  id,
  setId,
  openStrings,
}: {
  documents: Documents
  onChange: (value: Documents) => void
  locale: string
  setLocale: (value: string) => void
  id: string
  setId: (value: string) => void
  openStrings: (value: string) => void
}) {
  const chapters = chapterList(documents),
    quests = questList(documents),
    words = localeText(documents, locale),
    book = {
      ...documents['quests/book.json'],
      native: documents['quests/book.json'].native ?? {},
    }
  const [chapterKey, setChapter] = useState('workshop'),
    [query, setQuery] = useState(''),
    [mode, setMode] = useState('quest'),
    [tab, setTab] = useState('text'),
    [layout, setLayout] = useState(true),
    [newKey, setNewKey] = useState(''),
    [newTitle, setNewTitle] = useState(''),
    [newItem, setNewItem] = useState(''),
    [error, setError] = useState(''),
    [newDependency, setNewDependency] = useState('')
  const selected = quests.find((row) => row.id === id),
    chapter =
      chapters.find(
        (row) =>
          row.key ===
          (selected && mode === 'quest' ? selected.chapterKey : chapterKey),
      ) ?? chapters[0]
  const active = selected ?? chapter?.quests[0],
    entry = active && { ...active, native: active.native ?? {} },
    source = chapter && {
      ...documents[chapterPath(chapter.key)],
      native: documents[chapterPath(chapter.key)].native ?? {},
    }
  const locales = Object.keys(documents)
    .filter((name) => name.startsWith('quests/locales/'))
    .map((name) => name.split('/').at(-1)!.slice(0, -5))
  const apply = (work: () => Documents) => {
    try {
      onChange(work())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const change = (value: any, destination?: string) =>
    apply(() => updateQuest(documents, entry.id, value, destination))
  const native = (key: string, value: any) =>
    change({
      native:
        value === undefined
          ? omit(entry.native, key)
          : { ...entry.native, [key]: value },
    })
  function choose(id: string) {
    const row = quests.find((row) => row.id === id)
    if (row) setChapter(row.chapterKey)
    setId(id)
    setMode('quest')
    setError('')
  }
  function create() {
    try {
      const next =
        mode === 'newchapter'
          ? createChapter(
              documents,
              newKey,
              newTitle,
              newItem || 'minecraft:book',
            )
          : createQuest(documents, chapter.key, newKey, newTitle, newItem)
      onChange(next)
      setLocale('en_us')
      setError('')
      setNewKey('')
      setNewTitle('')
      setNewItem('')
      if (mode === 'newchapter') {
        setChapter(newKey)
        setMode('chapter')
        setId('')
      } else {
        setId(questList(next).find((row) => row.key === newKey).id)
        setMode('quest')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const editChapter = (value: any) =>
    apply(() => updateChapter(documents, chapter.key, value))
  const bookNative = (key: string, value: any) =>
    onChange({
      ...documents,
      'quests/book.json': { ...book, native: { ...book.native, [key]: value } },
    })
  return (
    <Workbench
      browser={
        <>
          <Field label={<>Chapter</>}>
            {(attrs) => (
              <select
                {...attrs}
                value={chapter?.key ?? ''}
                onChange={(e) => {
                  const chapter = chapters.find(
                    (row) => row.key === e.target.value,
                  )
                  setChapter(e.target.value)
                  setId(chapter?.quests[0]?.id ?? '')
                  setMode(chapter?.quests.length ? 'quest' : 'chapter')
                  setError('')
                }}
              >
                {chapters.map((row) => (
                  <option key={row.id} value={row.key}>
                    {words.objects[row.id].title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="action-row">
            <Button
              onClick={() => {
                setMode('newchapter')
                setError('')
              }}
            >
              New chapter
            </Button>
            <Button
              onClick={() => {
                setMode('book')
                setError('')
              }}
            >
              Book settings
            </Button>
          </div>
          <Field label={<>Find quest</>}>
            {(attrs) => (
              <input
                {...attrs}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
          </Field>
          <div className="action-row">
            <Button
              disabled={!chapter}
              onClick={() => {
                setMode('newquest')
                setError('')
              }}
            >
              New quest
            </Button>
          </div>
          <nav className="entry-list quest-browser" aria-label="Quests">
            {(query ? chapters : chapter ? [chapter] : []).map((c) => (
              <section key={c.id}>
                {query && <h2>{words.objects[c.id].title}</h2>}
                {c.quests
                  .filter((row: any) =>
                    `${row.key} ${words.objects[row.id].title}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((row: any) => (
                    <Button
                      key={row.id}
                      aria-current={entry?.id === row.id && mode === 'quest'}
                      onClick={() => choose(row.id)}
                    >
                      {words.objects[row.id].title}
                    </Button>
                  ))}
              </section>
            ))}
          </nav>
          <p className="scope">
            {quests.length} quests · {chapters.length} chapters
          </p>
        </>
      }
    >
      <section className="content-stack quest-editor" aria-label="Quest editor">
        {error && <Feedback tone="error">{error}</Feedback>}
        <div className="control-row">
          <Field label={<>Text locale</>}>
            {(attrs) => (
              <select
                {...attrs}
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                {locales.map((id) => (
                  <option key={id} value={id}>
                    {localeLabel(id)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {chapter && (
            <Button
              aria-pressed={mode === 'chapter'}
              onClick={() => {
                setChapter(chapter.key)
                setMode('chapter')
                setError('')
              }}
            >
              Chapter settings
            </Button>
          )}
          {mode !== 'quest' && entry && (
            <Button
              onClick={() => {
                setMode('quest')
                setError('')
              }}
            >
              Back to quest
            </Button>
          )}
        </div>
        {mode === 'newchapter' || mode === 'newquest' ? (
          <section className="content-stack">
            <h2 data-text-role="section-title">
              {mode === 'newchapter' ? 'New chapter' : 'New quest'}
            </h2>
            <Text label="Source key" value={newKey} onChange={setNewKey} />
            <Text
              label="English title"
              value={newTitle}
              onChange={setNewTitle}
            />
            <Text
              label={
                mode === 'newchapter'
                  ? 'Icon item ID · optional'
                  : 'First task item ID'
              }
              value={newItem}
              onChange={setNewItem}
            />
            <p className="scope">
              Native IDs are allocated once and retained when titles, layout or
              chapter membership change.
            </p>
            <div className="action-row">
              <Button intent="primary" onClick={create}>
                Create {mode === 'newchapter' ? 'chapter' : 'quest'}
              </Button>
              <Button onClick={() => setMode(entry ? 'quest' : 'book')}>
                Cancel
              </Button>
            </div>
          </section>
        ) : mode === 'book' ? (
          <section className="content-stack" aria-label="Book settings">
            <h2 data-text-role="section-title">Book settings</h2>
            <Choice
              label="Progression"
              value={book.native.progression_mode ?? 'linear'}
              choices={[
                ['flexible', 'Flexible · retain early task progress'],
                ['linear', 'Linear · prerequisites first'],
              ]}
              onChange={(value) => bookNative('progression_mode', value)}
            />
            <Choice
              label="Default reward scope"
              value={String(book.native.default_reward_team ?? false)}
              choices={[
                ['false', 'Per player'],
                ['true', 'Per team'],
              ]}
              onChange={(value) =>
                bookNative('default_reward_team', value === 'true')
              }
            />
            <Choice
              label="Default item submission"
              value={String(book.native.default_consume_items ?? false)}
              choices={[
                ['false', 'Detect and keep'],
                ['true', 'Consume'],
              ]}
              onChange={(value) =>
                bookNative('default_consume_items', value === 'true')
              }
            />
            <Choice
              label="Default collection"
              value={book.native.default_autoclaim_rewards ?? 'disabled'}
              choices={[
                ['disabled', 'Manual claim'],
                ['enabled', 'Automatic'],
                ['no_toast', 'Automatic without toast'],
                ['invisible', 'Automatic, hidden'],
              ]}
              onChange={(value) =>
                bookNative('default_autoclaim_rewards', value)
              }
            />
            <Disclosure summary={<>Native book properties</>}>
              <JsonEditor
                id="quests/book/native"
                label="Book properties JSON"
                value={book.native}
                onApply={(value) =>
                  onChange({
                    ...documents,
                    'quests/book.json': { ...book, native: value },
                  })
                }
              />
            </Disclosure>
            <h3 data-text-role="group-title">Chapter groups</h3>
            {book.groups.map((group: any) => (
              <fieldset className="content-stack quest-row" key={group.id}>
                <legend>{group.key}</legend>
                <ObjectText
                  documents={documents}
                  onChange={onChange}
                  locale={locale}
                  id={group.id}
                />
                <Button
                  intent="destructive"
                  onClick={() => apply(() => removeGroup(documents, group.id))}
                >
                  Delete unused group
                </Button>
              </fieldset>
            ))}
            <Text label="New group key" value={newKey} onChange={setNewKey} />
            <Text
              label="New group English title"
              value={newTitle}
              onChange={setNewTitle}
            />
            <div className="action-row">
              <Button
                onClick={() =>
                  apply(() => createGroup(documents, newKey, newTitle))
                }
              >
                Add chapter group
              </Button>
            </div>
          </section>
        ) : mode === 'chapter' && chapter ? (
          <section className="content-stack" aria-label="Chapter settings">
            <h2 data-text-role="section-title">
              {words.objects[chapter.id].title}
            </h2>
            <ObjectText
              documents={documents}
              onChange={onChange}
              locale={locale}
              id={chapter.id}
              descriptions
              chapter
            />
            <Choice
              label="Chapter group"
              value={source.group ?? ''}
              choices={[
                ['', 'No group'],
                ...book.groups.map(
                  (group: any) =>
                    [group.id, words.objects[group.id].title] as [
                      string,
                      string,
                    ],
                ),
              ]}
              onChange={(group) => editChapter({ group })}
            />
            <Count
              id={chapter.id + '/order'}
              label="Chapter order"
              min={0}
              value={source.order}
              onChange={(order) => editChapter({ order })}
            />
            <Text
              label="Chapter icon item ID"
              value={
                typeof source.native.icon === 'string'
                  ? source.native.icon
                  : (source.native.icon?.id ?? '')
              }
              onChange={(icon) =>
                editChapter({
                  native: icon
                    ? { ...source.native, icon }
                    : omit(source.native, 'icon'),
                })
              }
            />
            <Disclosure summary={<>Native chapter properties</>}>
              <JsonEditor
                id={chapter.id + '/native'}
                label="Chapter properties JSON"
                value={source.native}
                onApply={(native) => {
                  if (
                    !native ||
                    typeof native !== 'object' ||
                    Array.isArray(native)
                  )
                    throw new Error('Native properties must be an object.')
                  onChange(updateChapter(documents, chapter.key, { native }))
                }}
              />
            </Disclosure>
            <div className="action-row">
              <Button
                intent="destructive"
                disabled={source.quests.length > 0}
                onClick={() => {
                  if (
                    confirm('Delete this empty chapter and its translations?')
                  )
                    apply(() => removeChapter(documents, chapter.key))
                }}
              >
                Delete empty chapter
              </Button>
            </div>
          </section>
        ) : entry && chapter ? (
          <>
            <header className="section-heading">
              <h2 data-text-role="section-title">
                {words.objects[entry.id].title}
              </h2>
              <div className="action-row">
                <label className="inline-field">
                  <input
                    type="checkbox"
                    checked={layout}
                    onChange={(e) => setLayout(e.target.checked)}
                  />
                  Chapter layout
                </label>
                <Button
                  intent="destructive"
                  onClick={() => {
                    if (
                      confirm(
                        'Delete this quest, its tasks, rewards and translations? Native progress is not migrated.',
                      )
                    )
                      apply(() => removeQuest(documents, entry.id))
                  }}
                >
                  Delete quest
                </Button>
              </div>
            </header>
            <div
              className="quest-workspace"
              data-layout={layout ? 'canvas' : 'inspector'}
            >
              {layout && (
                <ChapterLayout
                  key={chapter.id}
                  quests={chapter.quests}
                  titles={words.objects}
                  selected={entry.id}
                  onSelect={choose}
                  onPosition={(id, x, y) =>
                    apply(() => updateQuest(documents, id, { x, y }))
                  }
                />
              )}
              <section
                className="content-stack quest-inspector"
                aria-label="Selected quest"
              >
                <ViewTabs label="Quest properties">
                  {['text', 'tasks', 'rewards', 'links', 'preview'].map(
                    (view) => (
                      <Button
                        key={view}
                        aria-pressed={tab === view}
                        onClick={() => setTab(view)}
                      >
                        {view[0].toUpperCase() + view.slice(1)}
                      </Button>
                    ),
                  )}
                </ViewTabs>
                {tab === 'text' && (
                  <ObjectText
                    documents={documents}
                    onChange={onChange}
                    locale={locale}
                    id={entry.id}
                    descriptions
                  />
                )}
                {tab === 'tasks' && (
                  <TaskEditor
                    id={entry.id}
                    rows={entry.tasks}
                    onChange={(tasks) => change({ tasks })}
                    documents={documents}
                    changeDocuments={onChange}
                    locale={locale}
                  />
                )}
                {tab === 'rewards' && (
                  <RewardEditor
                    id={entry.id}
                    rows={entry.rewards}
                    onChange={(rewards) => change({ rewards })}
                    documents={documents}
                    changeDocuments={onChange}
                    locale={locale}
                  />
                )}
                {tab === 'links' && (
                  <div className="content-stack">
                    <Choice
                      label="Chapter membership"
                      value={chapter.key}
                      choices={chapters.map((c) => [
                        c.key,
                        words.objects[c.id].title,
                      ])}
                      onChange={(value) => {
                        setChapter(value)
                        change({}, value)
                      }}
                    />
                    <div className="control-row">
                      <Count
                        id={entry.id + '/x'}
                        label="X"
                        min={-100000}
                        step={0.25}
                        value={entry.x}
                        onChange={(x) => change({ x })}
                      />
                      <Count
                        id={entry.id + '/y'}
                        label="Y"
                        min={-100000}
                        step={0.25}
                        value={entry.y}
                        onChange={(y) => change({ y })}
                      />
                    </div>
                    <h3 data-text-role="group-title">Prerequisites</h3>
                    {entry.dependencies.map((dep: string) => (
                      <div className="control-row" key={dep}>
                        <Button onClick={() => choose(dep)}>
                          {words.objects[dep]?.title ?? dep}
                        </Button>
                        <Button
                          intent="destructive"
                          aria-label={`Remove prerequisite ${words.objects[dep]?.title ?? dep}`}
                          onClick={() =>
                            change({
                              dependencies: entry.dependencies.filter(
                                (id: string) => id !== dep,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {!entry.dependencies.length && <p>No prerequisites.</p>}
                    <Field label={<>Add prerequisite</>}>
                      {(attrs) => (
                        <select
                          {...attrs}
                          value={newDependency}
                          onChange={(e) => setNewDependency(e.target.value)}
                        >
                          <option value="">Choose a quest…</option>
                          {chapters.map((c) => (
                            <optgroup
                              key={c.id}
                              label={words.objects[c.id].title}
                            >
                              {c.quests
                                .filter(
                                  (q: any) =>
                                    q.id !== entry.id &&
                                    !entry.dependencies.includes(q.id),
                                )
                                .map((q: any) => (
                                  <option key={q.id} value={q.id}>
                                    {words.objects[q.id].title}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </Field>
                    <div className="action-row">
                      <Button
                        disabled={!newDependency}
                        onClick={() => {
                          change({
                            dependencies: [
                              ...entry.dependencies,
                              newDependency,
                            ],
                          })
                          setNewDependency('')
                        }}
                      >
                        Add prerequisite
                      </Button>
                    </div>
                    <Choice
                      label="Dependency rule"
                      value={
                        entry.native.dependency_requirement ?? 'all_completed'
                      }
                      choices={[
                        ['all_completed', 'All completed'],
                        ['one_completed', 'Any completed'],
                        ['all_started', 'All started'],
                        ['one_started', 'Any started'],
                      ]}
                      onChange={(value) =>
                        native(
                          'dependency_requirement',
                          value === 'all_completed' ? undefined : value,
                        )
                      }
                    />
                    <Count
                      id={entry.id + '/minimum'}
                      label="Minimum prerequisites · 0 uses rule"
                      min={0}
                      value={entry.native.min_required_dependencies ?? 0}
                      onChange={(value) =>
                        native(
                          'min_required_dependencies',
                          value === 0 ? undefined : value,
                        )
                      }
                    />
                    <Choice
                      label="Quest progression"
                      value={entry.native.progression_mode ?? 'inherit'}
                      choices={[
                        ['inherit', 'Book/chapter default'],
                        ['flexible', 'Flexible'],
                        ['linear', 'Linear'],
                      ]}
                      onChange={(value) =>
                        native(
                          'progression_mode',
                          value === 'inherit' ? undefined : value,
                        )
                      }
                    />
                    <label className="inline-field">
                      <input
                        type="checkbox"
                        checked={entry.native.optional === true}
                        onChange={(e) =>
                          native('optional', e.target.checked || undefined)
                        }
                      />
                      Optional quest
                    </label>
                  </div>
                )}
                {tab === 'preview' && (
                  <article className="content-stack quest-text-preview">
                    <h3 data-text-role="group-title">
                      {words.objects[entry.id].title}
                    </h3>
                    {words.objects[entry.id].quest_subtitle && (
                      <p className="scope">
                        {words.objects[entry.id].quest_subtitle}
                      </p>
                    )}
                    {paragraphs(
                      words.objects[entry.id].quest_desc,
                      words.shared,
                    ).map((p: string, i: number) => (
                      <p key={i}>{p}</p>
                    ))}
                    <h4>Tasks</h4>
                    <ul>
                      {entry.tasks.map((row: any) => (
                        <li key={row.id}>
                          {words.objects[row.id].title}
                          {row.type === 'item' ? ` · ${row.count ?? 1}` : ''}
                        </li>
                      ))}
                    </ul>
                    <h4>Rewards</h4>
                    {entry.rewards.length ? (
                      <ul>
                        {entry.rewards.map((row: any) => (
                          <li key={row.id}>
                            {words.objects[row.id].title} ·{' '}
                            {row.count ?? row[row.type] ?? 1} ·{' '}
                            {row.native?.team_reward === true
                              ? 'per team'
                              : row.native?.team_reward === false
                                ? 'per player'
                                : 'book scope'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No rewards.</p>
                    )}
                    <Button onClick={() => openStrings(`objects.${entry.id}.`)}>
                      Open localization
                    </Button>
                  </article>
                )}
                <Disclosure summary={<>Quest source and native properties</>}>
                  <p className="scope">
                    Keep native IDs stable. This changes definitions, never
                    saved player/team progress.
                  </p>
                  <JsonEditor
                    id={entry.id + '/source'}
                    label="Quest JSON"
                    value={documents[chapterPath(chapter.key)].quests.find(
                      (row: any) => row.id === entry.id,
                    )}
                    onApply={(value) =>
                      onChange(updateQuest(documents, entry.id, value))
                    }
                  />
                </Disclosure>
              </section>
            </div>
          </>
        ) : (
          <p>No quests in this chapter. Create one to begin.</p>
        )}
      </section>
    </Workbench>
  )
}
