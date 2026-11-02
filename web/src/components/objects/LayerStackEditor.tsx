import { useEffect, useState } from 'react'
import SortableList from '../ui/SortableList'
import Button from '../ui/Button'
import Field from '../ui/Field'
import type { ObjectCatalogue } from '../../lib/object-resources'

type Props = {
  layers: ObjectCatalogue['layers']
  value: string[]
  busy: boolean
  onPreview: (layers: string[]) => void
}
export default function LayerStackEditor({
  layers,
  value,
  busy,
  onPreview,
}: Props) {
  const key = JSON.stringify(value)
  const [draft, setDraft] = useState(value),
    [selected, setSelected] = useState(''),
    [addition, setAddition] = useState('')
  useEffect(() => setDraft(JSON.parse(key)), [key])
  const editable = (id: string) =>
    !['mod', 'vanilla'].includes(
      layers.find((layer) => layer.id === id)?.kind ?? '',
    )
  const foundation = draft.filter((id) => !editable(id)),
    movable = draft.filter(editable)
  const choices = layers.filter(
    (layer) => editable(layer.id) && !draft.includes(layer.id),
  )
  const index = movable.indexOf(selected)
  const replace = (items: string[]) => setDraft([...foundation, ...items])
  function move(id: string, target: number) {
    const next = movable.filter((value) => value !== id)
    next.splice(target, 0, id)
    replace(next)
  }
  return (
    <div className="content-stack">
      <p data-text-role="caption">
        Low priority first. Base game and native mod inputs stay below these
        contributors. Changes apply only to this preview.
      </p>
      <SortableList
        label="Comparison layers"
        items={movable.map((id) => ({
          id,
          label: layers.find((layer) => layer.id === id)?.label ?? id,
        }))}
        selected={selected}
        disabled={busy}
        onSelect={setSelected}
        onMove={move}
        actions={[
          {
            id: 'up',
            icon: 'up',
            label: 'Move contributor earlier',
            disabled: index <= 0,
            onClick: () => move(selected, index - 1),
          },
          {
            id: 'down',
            icon: 'down',
            label: 'Move contributor later',
            disabled: index < 0 || index >= movable.length - 1,
            onClick: () => move(selected, index + 1),
          },
          {
            id: 'remove',
            icon: 'delete',
            label: 'Exclude contributor from preview',
            disabled: index < 0,
            onClick: () => {
              replace(movable.filter((id) => id !== selected))
              setSelected('')
            },
          },
        ]}
      />
      <Field label="Add contributor">
        {(attributes) => (
          <select
            {...attributes}
            value={addition}
            onChange={(event) => setAddition(event.target.value)}
          >
            <option value="">Choose a known source</option>
            {choices.map((layer) => (
              <option value={layer.id} key={layer.id}>
                {layer.label} · {layer.kind}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="action-row">
        <Button
          disabled={busy || !addition}
          onClick={() => {
            replace([...movable, addition])
            setSelected(addition)
            setAddition('')
          }}
        >
          Add
        </Button>
        <Button
          disabled={busy || JSON.stringify(draft) === key}
          onClick={() => onPreview(draft)}
        >
          Preview stack
        </Button>
        <Button
          disabled={busy || JSON.stringify(draft) === key}
          onClick={() => setDraft(value)}
        >
          Reset draft
        </Button>
      </div>
    </div>
  )
}
