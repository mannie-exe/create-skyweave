import { useState } from 'react'
import Field from '../../ui/Field'
import Workbench from '../../ui/Workbench'
import Feedback from '../../ui/Feedback'
import Button from '../../ui/Button'
import {
  localeText,
  sharedUses,
  objectList,
  createShared,
  removeShared,
} from '../../../lib/quests.mjs'
import type { Documents } from './ObjectText'
export default function SharedText({
  documents,
  onChange,
  locale,
  openStrings,
  openEntry,
  id,
  setId,
}: {
  id: string
  setId: (id: string) => void
  documents: Documents
  onChange: (value: Documents) => void
  locale: string
  openStrings: (value: string) => void
  openEntry: (value: string) => void
}) {
  const [query, setQuery] = useState(''),
    [creating, setCreating] = useState(false),
    [key, setKey] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  const words = localeText(documents, locale),
    keys = Object.keys(words.shared),
    selected = keys.includes(id) ? id : keys[0],
    uses = sharedUses(documents, selected)
  return (
    <Workbench
      browser={
        <>
          <Field label={<>Find shared text</>}>
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
            <Button onClick={() => setCreating(true)}>New shared text</Button>
          </div>
          <nav className="entry-list" aria-label="Shared text">
            {keys
              .filter((key) =>
                `${key} ${words.shared[key]}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((key) => (
                <Button
                  key={key}
                  aria-current={selected === key && !creating}
                  onClick={() => {
                    setId(key)
                    setCreating(false)
                    setError('')
                  }}
                >
                  {key}
                </Button>
              ))}
          </nav>
        </>
      }
    >
      <section className="content-stack">
        {error && <Feedback tone="error">{error}</Feedback>}
        {creating ? (
          <>
            <h2 data-text-role="section-title">New shared text</h2>
            <Field label={<>Key</>}>
              {(attrs) => (
                <input
                  {...attrs}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              )}
            </Field>
            <Field label={<>English message</>}>
              {(attrs) => (
                <textarea
                  {...attrs}
                  value={message}
                  rows={4}
                  onChange={(e) => setMessage(e.target.value)}
                />
              )}
            </Field>
            <div className="action-row">
              <Button
                intent="primary"
                onClick={() => {
                  try {
                    onChange(createShared(documents, key, message))
                    setId(key)
                    setCreating(false)
                    setKey('')
                    setMessage('')
                    setError('')
                  } catch (e) {
                    setError(String(e))
                  }
                }}
              >
                Create shared text
              </Button>
              <Button onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </>
        ) : selected ? (
          <>
            <h2 data-text-role="section-title">{selected}</h2>
            <p className="message-preview">{words.shared[selected]}</p>
            <div className="action-row">
              <Button onClick={() => openStrings(`shared.${selected}`)}>
                Edit localized message
              </Button>
              <Button
                intent="destructive"
                disabled={uses.length > 0}
                onClick={() => {
                  if (
                    confirm('Delete this unused shared text in every locale?')
                  ) {
                    onChange(removeShared(documents, selected))
                    setError('')
                  }
                }}
              >
                Delete shared text
              </Button>
            </div>
            <h3 data-text-role="group-title">Used by</h3>
            {uses.length ? (
              <ul>
                {uses.map((id) => {
                  const row = objectList(documents).find((row) => row.id === id)
                  return (
                    <li key={id}>
                      <Button
                        onClick={() =>
                          row?.type === 'quest'
                            ? openEntry(id)
                            : openStrings(`objects.${id}.`)
                        }
                      >
                        {words.objects[id]?.title ?? id}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p>No references in any locale.</p>
            )}
          </>
        ) : (
          <p>No shared text. Create a message to reuse it in descriptions.</p>
        )}
      </section>
    </Workbench>
  )
}
