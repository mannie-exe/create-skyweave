import Field from '../../ui/Field'
import Button from '../../ui/Button'
import { localePath, localeText, setText } from '../../../lib/quests.mjs'
import Paragraphs from './Paragraphs'
export type Documents = Record<string, any>
export default function ObjectText({
  documents,
  onChange,
  locale,
  id,
  descriptions = false,
  chapter = false,
}: {
  documents: Documents
  onChange: (value: Documents) => void
  locale: string
  id: string
  descriptions?: boolean
  chapter?: boolean
}) {
  const words = localeText(documents, locale),
    value = words.objects[id],
    local = documents[localePath(locale)]?.objects?.[id] ?? {}
  const change = (field: string, value: any) =>
    onChange(setText(documents, locale, ['objects', id, field], value))
  return (
    <div className="content-stack">
      <Field label={<>Title · {locale}</>}>
        {(attrs) => (
          <input
            {...attrs}
            value={value.title}
            onChange={(e) => change('title', e.target.value)}
          />
        )}
      </Field>
      {descriptions && !chapter && (
        <Field label={<>Subtitle</>}>
          {(attrs) => (
            <input
              {...attrs}
              value={value.quest_subtitle ?? ''}
              onChange={(e) => change('quest_subtitle', e.target.value)}
            />
          )}
        </Field>
      )}
      {descriptions && (
        <Paragraphs
          label={chapter ? 'Chapter introduction' : 'Description'}
          shared={words.shared}
          value={value[chapter ? 'chapter_subtitle' : 'quest_desc'] ?? []}
          onChange={(value) =>
            change(chapter ? 'chapter_subtitle' : 'quest_desc', value)
          }
        />
      )}
      {locale !== 'en_us' && (
        <div className="action-row">
          {Object.keys(local).map((field) => (
            <Button
              key={field}
              intent="destructive"
              onClick={() => change(field, undefined)}
            >
              Use English {field.replaceAll('_', ' ')}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
