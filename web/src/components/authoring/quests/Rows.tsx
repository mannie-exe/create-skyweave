import Field from '../../ui/Field'
import { useId } from 'react'
import { useDrafts } from './Drafts'
import Button from '../../ui/Button'
import Disclosure from '../../ui/Disclosure'
import JsonEditor from './JsonEditor'
import ObjectText, { type Documents } from './ObjectText'
import { newCode } from '../../../lib/quests.mjs'

const omit = (value: any, key: string) => {
  const next = { ...value }
  delete next[key]
  return next
}
export function Choice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: string
  choices: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <Field label={<>{label}</>}>
      {(attrs) => (
        <select
          {...attrs}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {choices.map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}
export function Text({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={<>{label}</>}>
      {(attrs) => (
        <input
          {...attrs}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}
export function Count({
  label = 'Count',
  value,
  onChange,
  min = 1,
  step = 1,
  id,
}: {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
  id?: string
}) {
  const generated = useId(),
    fieldId = 'number/' + (id ?? generated),
    { drafts, setDraft } = useDrafts()
  return (
    <Field
      label={<>{label}</>}
      error={
        drafts[fieldId] !== undefined ? 'Enter a finite number.' : undefined
      }
    >
      {(attrs) => (
        <input
          {...attrs}
          type="number"
          min={min}
          step={step}
          max={Number.MAX_SAFE_INTEGER}
          value={drafts[fieldId] ?? (Number.isFinite(value) ? value : '')}
          onChange={(e) => {
            if (!e.target.value || !Number.isFinite(e.target.valueAsNumber))
              setDraft(fieldId, e.target.value)
            else {
              setDraft(fieldId, undefined)
              onChange(e.target.valueAsNumber)
            }
          }}
        />
      )}
    </Field>
  )
}
function PositionTools({
  rows,
  index,
  onChange,
  label,
  minimum = 0,
}: {
  rows: any[]
  index: number
  onChange: (value: any[]) => void
  label: string
  minimum?: number
}) {
  const move = (by: number) => {
    const next = [...rows]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    onChange(next)
  }
  return (
    <div className="action-row">
      <Button
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        onClick={() => move(-1)}
      >
        Up
      </Button>
      <Button
        disabled={index === rows.length - 1}
        aria-label={`Move ${label} down`}
        onClick={() => move(1)}
      >
        Down
      </Button>
      <Button
        intent="destructive"
        disabled={rows.length <= minimum}
        onClick={() => {
          if (
            confirm(
              `Remove ${label}? Its saved task or reward identity will be retired.`,
            )
          )
            onChange(rows.filter((_, i) => i !== index))
        }}
      >
        Remove {label}
      </Button>
    </div>
  )
}
export function TaskEditor({
  id,
  rows,
  onChange,
  documents,
  changeDocuments,
  locale,
}: {
  id: string
  rows: any[]
  onChange: (value: any[]) => void
  documents: Documents
  changeDocuments: (value: Documents) => void
  locale: string
}) {
  const change = (index: number, value: any) =>
    onChange(rows.map((row, i) => (index === i ? value : row)))
  return (
    <section className="content-stack" aria-label="Tasks">
      {rows.map((row, index) => (
        <fieldset className="content-stack quest-row" key={row.id}>
          <legend>Task {index + 1}</legend>
          <ObjectText
            documents={documents}
            onChange={changeDocuments}
            locale={locale}
            id={row.id}
          />
          <Choice
            label="Evidence"
            value={row.type}
            choices={[
              ['item', 'Inventory items'],
              ['advancement', 'Native advancement'],
              ['interaction', 'Block interaction'],
              ['checkmark', 'Manual acknowledgement'],
            ]}
            onChange={(type) =>
              change(index, {
                id: row.id,
                type,
                ...(row.native ? { native: row.native } : {}),
                ...(type === 'item'
                  ? {
                      item: { id: 'minecraft:stone', count: 1 },
                      count: 1,
                      consume_items: false,
                    }
                  : type === 'advancement'
                    ? { advancement: 'minecraft:story/root' }
                    : type === 'interaction'
                      ? {
                          interaction_type: 'block',
                          to_interact: 'minecraft:crafting_table',
                        }
                      : {}),
              })
            }
          />
          {row.type === 'item' && (
            <>
              <Choice
                label="Accepted items"
                value={
                  row.match?.tag !== undefined
                    ? 'tag'
                    : row.match
                      ? 'items'
                      : 'item'
                }
                choices={[
                  ['item', 'One item'],
                  ['items', 'Any listed items'],
                  ['tag', 'Item tag'],
                ]}
                onChange={(mode) => {
                  const next = omit(
                    omit(omit(row, 'item'), 'match'),
                    'match_components',
                  )
                  change(index, {
                    ...next,
                    ...(mode === 'item'
                      ? {
                          item: {
                            id:
                              row.item?.id ??
                              row.match?.items?.[0] ??
                              'minecraft:stone',
                            count: 1,
                          },
                        }
                      : {
                          match:
                            mode === 'tag'
                              ? { tag: '' }
                              : { items: [row.item?.id ?? 'minecraft:stone'] },
                        }),
                  })
                }}
              />
              {row.item && (
                <Text
                  label="Item ID"
                  value={row.item.id}
                  onChange={(value) =>
                    change(index, { ...row, item: { ...row.item, id: value } })
                  }
                />
              )}
              {row.match?.items && (
                <Field label={<>Item choices · one ID per line</>}>
                  {(attrs) => (
                    <textarea
                      {...attrs}
                      rows={4}
                      value={row.match.items.join('\n')}
                      onChange={(e) =>
                        change(index, {
                          ...row,
                          match: { items: e.target.value.split('\n') },
                        })
                      }
                    />
                  )}
                </Field>
              )}
              {row.match?.tag !== undefined && (
                <Text
                  label="Item tag ID"
                  value={row.match.tag}
                  onChange={(value) =>
                    change(index, { ...row, match: { tag: value } })
                  }
                />
              )}
              <Count
                id={row.id + '/count'}
                value={row.count ?? 1}
                onChange={(count) => change(index, { ...row, count })}
              />
              {row.match && (
                <p className="scope">
                  Matching stacks count together. Requires the Skyweave
                  quest-item adaptation.
                </p>
              )}
              <Choice
                label="Submission"
                value={
                  row.consume_items === undefined
                    ? 'inherit'
                    : row.consume_items
                      ? 'consume'
                      : 'detect'
                }
                choices={[
                  ['inherit', 'Book/chapter default'],
                  ['detect', 'Detect and keep items'],
                  ['consume', 'Consume submitted items'],
                ]}
                onChange={(value) =>
                  change(
                    index,
                    value === 'inherit'
                      ? omit(row, 'consume_items')
                      : { ...row, consume_items: value === 'consume' },
                  )
                }
              />
              <label className="inline-field">
                <input
                  type="checkbox"
                  checked={row.only_from_crafting === true}
                  onChange={(e) =>
                    change(index, {
                      ...row,
                      only_from_crafting: e.target.checked,
                    })
                  }
                />
                Crafting output only
              </label>
            </>
          )}
          {row.type === 'advancement' && (
            <>
              <Text
                label="Advancement ID"
                value={row.advancement}
                onChange={(value) =>
                  change(index, { ...row, advancement: value })
                }
              />
              <Text
                label="Criterion · blank for complete advancement"
                value={row.criterion ?? ''}
                onChange={(value) =>
                  change(index, { ...row, criterion: value })
                }
              />
            </>
          )}
          {row.type === 'interaction' && (
            <Text
              label="Interacted block ID"
              value={row.to_interact}
              onChange={(value) =>
                change(index, { ...row, to_interact: value })
              }
            />
          )}
          {row.type === 'checkmark' && (
            <p className="scope">
              The player marks this complete. No build, journey or client
              gesture is detected.
            </p>
          )}
          <Disclosure summary={<>Task source</>}>
            <JsonEditor
              id={id + '/' + row.id}
              label="Task JSON"
              hint="Keep native IDs stable. Unknown task types and fields are rejected on save."
              value={row}
              onApply={(value) => {
                if (value.id !== row.id)
                  throw new Error('Keep the task ID stable.')
                change(index, value)
              }}
            />
          </Disclosure>
          <PositionTools
            rows={rows}
            index={index}
            onChange={onChange}
            label={`task ${index + 1}`}
            minimum={1}
          />
        </fieldset>
      ))}
      <div className="action-row">
        <Button
          onClick={() =>
            onChange([
              ...rows,
              {
                id: newCode(documents),
                type: 'item',
                item: { id: 'minecraft:stone', count: 1 },
                count: 1,
                consume_items: false,
              },
            ])
          }
        >
          Add task
        </Button>
      </div>
    </section>
  )
}
export function RewardEditor({
  id,
  rows,
  onChange,
  documents,
  changeDocuments,
  locale,
}: {
  id: string
  rows: any[]
  onChange: (value: any[]) => void
  documents: Documents
  changeDocuments: (value: Documents) => void
  locale: string
}) {
  const change = (index: number, value: any) =>
    onChange(rows.map((row, i) => (index === i ? value : row)))
  const native = (row: any, key: string, value: any) => ({
    ...row,
    native:
      value === undefined
        ? omit(row.native ?? {}, key)
        : { ...row.native, [key]: value },
  })
  return (
    <section className="content-stack" aria-label="Rewards">
      {!rows.length && (
        <p>No rewards. Reference entries do not need supplies.</p>
      )}
      {rows.map((row, index) => (
        <fieldset className="content-stack quest-row" key={row.id}>
          <legend>Reward {index + 1}</legend>
          <ObjectText
            documents={documents}
            onChange={changeDocuments}
            locale={locale}
            id={row.id}
          />
          <Choice
            label="Reward type"
            value={row.type}
            choices={[
              ['item', 'Item'],
              ['xp', 'Experience points'],
              ['xp_levels', 'Experience levels'],
            ]}
            onChange={(type) =>
              change(index, {
                id: row.id,
                type,
                native: row.native ?? {},
                ...(type === 'item'
                  ? { item: { id: 'minecraft:stone', count: 1 }, count: 1 }
                  : { [type]: 1 }),
              })
            }
          />
          {row.type === 'item' ? (
            <>
              <Text
                label="Reward item ID"
                value={row.item.id}
                onChange={(value) =>
                  change(index, { ...row, item: { ...row.item, id: value } })
                }
              />
              <Count
                id={row.id + '/count'}
                value={row.count ?? 1}
                onChange={(count) => change(index, { ...row, count })}
              />
            </>
          ) : (
            <Count
              id={row.id + '/xp'}
              value={row[row.type]}
              onChange={(value) => change(index, { ...row, [row.type]: value })}
            />
          )}
          <Choice
            label="Claim scope"
            value={
              row.native?.team_reward === undefined
                ? 'inherit'
                : row.native.team_reward
                  ? 'team'
                  : 'player'
            }
            choices={[
              ['inherit', 'Book default'],
              ['team', 'Once per team'],
              ['player', 'Once per player'],
            ]}
            onChange={(value) =>
              change(
                index,
                native(
                  row,
                  'team_reward',
                  value === 'inherit' ? undefined : value === 'team',
                ),
              )
            }
          />
          <Choice
            label="Collection"
            value={row.native?.auto ?? 'inherit'}
            choices={[
              ['inherit', 'Book default'],
              ['disabled', 'Manual claim'],
              ['enabled', 'Automatic'],
              ['no_toast', 'Automatic, without toast'],
              ['invisible', 'Automatic, hidden'],
            ]}
            onChange={(value) =>
              change(
                index,
                native(row, 'auto', value === 'inherit' ? undefined : value),
              )
            }
          />
          <Disclosure summary={<>Reward source</>}>
            <JsonEditor
              id={id + '/' + row.id}
              label="Reward JSON"
              value={row}
              hint="Native item components and supported reward flags. Keep the reward ID stable."
              onApply={(value) => {
                if (value.id !== row.id)
                  throw new Error('Keep the reward ID stable.')
                change(index, value)
              }}
            />
          </Disclosure>
          <PositionTools
            rows={rows}
            index={index}
            onChange={onChange}
            label={`reward ${index + 1}`}
          />
        </fieldset>
      ))}
      <div className="action-row">
        <Button
          onClick={() =>
            onChange([
              ...rows,
              {
                id: newCode(documents),
                type: 'item',
                item: { id: 'minecraft:stone', count: 1 },
                count: 1,
                native: { auto: 'disabled' },
              },
            ])
          }
        >
          Add reward
        </Button>
      </div>
    </section>
  )
}
