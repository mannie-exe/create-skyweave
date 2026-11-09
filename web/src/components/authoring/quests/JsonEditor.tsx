import SourceEditor from '../../ui/SourceEditor'
import Button from '../../ui/Button'
import { useState } from 'react'
import { useDrafts } from './Drafts'
export default function JsonEditor({
  id,
  value,
  label,
  hint,
  onApply,
}: {
  id: string
  value: unknown
  label: string
  hint?: string
  onApply: (value: any) => void
}) {
  const { drafts, setDraft } = useDrafts(),
    [error, setError] = useState('')
  const text = drafts[id] ?? JSON.stringify(value, null, 2)
  return (
    <SourceEditor
      label={label}
      hint={hint}
      rows={10}
      value={text}
      error={error}
      onChange={(e) => setDraft(id, e.target.value)}
      actions={
        <>
          <Button
            type="button"
            onClick={() => {
              try {
                onApply(JSON.parse(text))
                setDraft(id, undefined)
                setError('')
              } catch (e) {
                setError(String(e))
              }
            }}
          >
            Apply {label.toLowerCase()}
          </Button>
          <Button
            intent="destructive"
            disabled={drafts[id] === undefined}
            onClick={() => {
              setDraft(id, undefined)
              setError('')
            }}
          >
            Discard JSON edit
          </Button>
        </>
      }
    />
  )
}
