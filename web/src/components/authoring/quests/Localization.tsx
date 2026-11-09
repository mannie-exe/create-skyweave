import Field from '../../ui/Field'
import Workbench from '../../ui/Workbench'
import Feedback from '../../ui/Feedback'
import Button from '../../ui/Button'
import Disclosure from '../../ui/Disclosure'
import { useState } from 'react'
import Paragraphs from './Paragraphs'
import { paragraphs } from '../../../lib/quests.mjs'
import {
  localeLabel,
  minecraftLocales,
  minecraftVersion,
} from '../../../lib/locales'
import {
  atPath,
  chapterList,
  localePath,
  localeText,
  setText,
  stringRows,
} from '../../../lib/quests.mjs'
export type Documents = Record<string, any>
export default function Localization({
  documents,
  onChange,
  locale,
  setLocale,
  initialSearch = '',
}: {
  documents: Documents
  onChange: (docs: Documents) => void
  locale: string
  setLocale: (locale: string) => void
  initialSearch?: string
}) {
  const [query, setQuery] = useState(initialSearch),
    [group, setGroup] = useState('all'),
    [newLocale, setNewLocale] = useState(''),
    [error, setError] = useState('')
  const rows = stringRows(documents),
    english = documents[localePath('en_us')],
    resolved = localeText(documents, locale)
  const visible = rows.filter(
    (r) =>
      (group === 'all' || r.group === group) &&
      `${r.path.join('.')} ${r.title} ${r.value} ${atPath(resolved, r.path)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const locales = Object.keys(documents)
    .filter((p) => p.startsWith('quests/locales/'))
    .map((p) => p.split('/').at(-1)!.slice(0, -5))
  const availableLocales = minecraftLocales.filter(
    ({ code }) => !locales.includes(code),
  )
  function createLocale() {
    if (!availableLocales.some(({ code }) => code === newLocale)) {
      setError('Choose a language that has not been added yet.')
      return
    }
    onChange({
      ...documents,
      [localePath(newLocale)]: {
        schema: 1,
        shared: {},
        objects: {},
      },
    })
    setLocale(newLocale)
    setNewLocale('')
    setError('')
  }
  const display = (value: any) =>
    Array.isArray(value)
      ? paragraphs(value, english.shared).join('\n\n')
      : (value ?? '')
  return (
    <Workbench
      browser={
        <>
          <Field label={<>Find key or text</>}>
            {(field) => (
              <input
                {...field}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
          </Field>
          <nav className="entry-list" aria-label="String categories">
            <Button
              aria-current={group === 'all'}
              onClick={() => setGroup('all')}
            >
              All strings
            </Button>
            <Button
              aria-current={group === 'shared'}
              onClick={() => setGroup('shared')}
            >
              Shared text
            </Button>
            {chapterList(documents).map((chapter) => (
              <Button
                key={chapter.id}
                aria-current={group === chapter.key}
                onClick={() => setGroup(chapter.key)}
              >
                {resolved.objects[chapter.id].title}
              </Button>
            ))}
          </nav>
          <Disclosure summary={<>Manage locales</>}>
            <Field
              label={<>Language to add</>}
              hint={
                <>
                  Minecraft {minecraftVersion} languages. Added locales are
                  omitted; untranslated text uses English.
                </>
              }
            >
              {(field) => (
                <select
                  {...field}
                  value={newLocale}
                  onChange={(e) => {
                    setNewLocale(e.target.value)
                    setError('')
                  }}
                  disabled={!availableLocales.length}
                >
                  <option value="">
                    {availableLocales.length
                      ? 'Choose a language…'
                      : 'All languages added'}
                  </option>
                  {availableLocales.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="action-row">
              <Button
                disabled={
                  !availableLocales.some(({ code }) => code === newLocale)
                }
                onClick={createLocale}
              >
                Add locale
              </Button>
            </div>
            {locale !== 'en_us' && (
              <Button
                intent="destructive"
                onClick={() => {
                  if (
                    !confirm(
                      `Delete ${locale} translations? English remains the fallback.`,
                    )
                  )
                    return
                  const next = { ...documents }
                  delete next[localePath(locale)]
                  onChange(next)
                  setLocale('en_us')
                }}
              >
                Delete {locale} locale
              </Button>
            )}
            {error && <Feedback tone="error">{error}</Feedback>}
          </Disclosure>
        </>
      }
    >
      <section className="content-stack">
        <div className="control-row">
          <Field label={<>Editing locale</>}>
            {(field) => (
              <select
                {...field}
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
          <span className="scope control-note">
            {visible.length} strings · Missing translations use English.
          </span>
        </div>
        {!visible.length && <p>No matching strings.</p>}
        <div className="quest-string-table table-scroll">
          <table>
            <thead>
              <tr>
                <th>Text</th>
                <th>en_us · source</th>
                {locale !== 'en_us' && <th>{locale} · translation</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = row.path.join('.'),
                  source = atPath(english, row.path),
                  target = atPath(documents[localePath(locale)], row.path)
                const edit = (id: string, value: any) =>
                  onChange(setText(documents, id, row.path, value))
                const editor = (id: string, value: any, translation = false) =>
                  Array.isArray(source) ? (
                    <Paragraphs
                      label={
                        translation
                          ? 'Translated paragraphs'
                          : 'Source paragraphs'
                      }
                      value={value ?? source}
                      shared={localeText(documents, id).shared}
                      onChange={(value) => edit(id, value)}
                    />
                  ) : (
                    <textarea
                      aria-label={`${translation ? 'Translation' : 'Source'} ${key}`}
                      rows={3}
                      value={value ?? ''}
                      placeholder={translation ? display(source) : undefined}
                      onChange={(e) => edit(id, e.target.value)}
                    />
                  )
                return (
                  <tr key={key}>
                    <th scope="row">
                      <div className="content-stack" data-space="control">
                        <span>{row.title}</span>
                        <Disclosure spacing="control" summary={<>Keys</>}>
                          <code>{key}</code>
                          <span>{row.native}</span>
                        </Disclosure>
                      </div>
                    </th>
                    <td>
                      {locale === 'en_us' ? (
                        editor('en_us', source)
                      ) : (
                        <p>{display(source) || 'Optional text is empty.'}</p>
                      )}
                    </td>
                    {locale !== 'en_us' && (
                      <td>
                        <div className="content-stack" data-space="control">
                          {editor(locale, target, true)}
                          <small className="scope">
                            {target === undefined
                              ? 'English fallback'
                              : 'Translated override'}
                          </small>
                          {target !== undefined && (
                            <div className="action-row">
                              <Button
                                intent="destructive"
                                onClick={() =>
                                  onChange(
                                    setText(
                                      documents,
                                      locale,
                                      row.path,
                                      undefined,
                                    ),
                                  )
                                }
                              >
                                Use English
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Workbench>
  )
}
