import Field from '../../ui/Field'
import Button from '../../ui/Button'
export type Paragraph = string | { shared: string }
export default function Paragraphs({
  value,
  shared,
  onChange,
  label = 'Description',
}: {
  value: Paragraph[]
  shared: Record<string, string>
  onChange: (value: Paragraph[]) => void
  label?: string
}) {
  const change = (index: number, next: Paragraph) =>
    onChange(value.map((row, i) => (i === index ? next : row)))
  return (
    <section className="content-stack" aria-label={label}>
      <h3 data-text-role="group-title">{label}</h3>
      {value.map((row, index) => (
        <div
          className="content-stack quest-paragraph"
          data-space="control"
          key={index}
        >
          <div className="control-row">
            <Field label={<>Paragraph {index + 1}</>}>
              {(attrs) => (
                <select
                  {...attrs}
                  value={typeof row === 'string' ? 'text' : 'shared'}
                  onChange={(e) =>
                    change(
                      index,
                      e.target.value === 'text'
                        ? ''
                        : { shared: Object.keys(shared)[0] ?? '' },
                    )
                  }
                >
                  <option value="text">Text</option>
                  <option value="shared" disabled={!Object.keys(shared).length}>
                    Shared text
                  </option>
                </select>
              )}
            </Field>
            <Button
              disabled={index === 0}
              aria-label={`Move paragraph ${index + 1} up`}
              onClick={() => {
                const next = [...value]
                ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                onChange(next)
              }}
            >
              Up
            </Button>
            <Button
              disabled={index === value.length - 1}
              aria-label={`Move paragraph ${index + 1} down`}
              onClick={() => {
                const next = [...value]
                ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                onChange(next)
              }}
            >
              Down
            </Button>
            <Button
              intent="destructive"
              aria-label={`Remove paragraph ${index + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
          {typeof row === 'string' ? (
            <Field label={<>Paragraph {index + 1} text</>}>
              {(attrs) => (
                <textarea
                  {...attrs}
                  rows={3}
                  value={row}
                  onChange={(e) => change(index, e.target.value)}
                />
              )}
            </Field>
          ) : (
            <>
              <Field label={<>Shared text key</>}>
                {(attrs) => (
                  <select
                    {...attrs}
                    value={row.shared}
                    onChange={(e) => change(index, { shared: e.target.value })}
                  >
                    {Object.keys(shared).map((key) => (
                      <option key={key}>{key}</option>
                    ))}
                  </select>
                )}
              </Field>
              <p className="scope">
                {shared[row.shared] ?? 'Shared text is missing.'}
              </p>
            </>
          )}
        </div>
      ))}
      <div className="action-row">
        <Button onClick={() => onChange([...value, ''])}>Add paragraph</Button>
      </div>
    </section>
  )
}
