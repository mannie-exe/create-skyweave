import { useEffect, useState } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'
import { Tooltip } from '@base-ui/react/tooltip'
import Button from './Button'
import IconButton from './IconButton'
import type { UIIcon } from '../../lib/ui-icons'
import type { ButtonIntent } from '../../lib/ui'
import '../../styles/sortable-list.css'

type SortableItem = { id: string; label: string; detail?: string }
export type SortableAction = {
  id: string
  icon: UIIcon
  label: string
  disabled?: boolean
  intent?: ButtonIntent
  onClick: () => void
}
type Props = {
  label: string
  items: SortableItem[]
  selected?: string
  disabled?: boolean
  actions?: SortableAction[]
  onSelect: (id: string) => void
  onMove: (id: string, index: number) => void
}
function Row({
  item,
  index,
  items,
  selected,
  disabled,
  onSelect,
  reducedMotion,
}: Props & { item: SortableItem; index: number; reducedMotion: boolean }) {
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
    disabled,
    transition: reducedMotion ? null : undefined,
  })
  return (
    <li
      ref={ref}
      className="sortable-list-item"
      data-dragging={isDragging}
      data-selected={item.id === selected}
      data-id={item.id}
    >
      <IconButton
        ref={handleRef}
        icon="drag"
        label={`Reorder ${item.label}`}
        disabled={disabled}
        className="sortable-handle"
      />
      <Button
        className="sortable-selection"
        aria-pressed={item.id === selected}
        disabled={disabled}
        title={item.detail}
        onClick={() => onSelect(item.id)}
        onKeyDown={(event) => {
          const delta =
            event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
          if (!delta) return
          event.preventDefault()
          const target = Math.max(0, Math.min(items.length - 1, index + delta))
          onSelect(items[target].id)
          event.currentTarget
            .closest('ol')
            ?.querySelectorAll<HTMLButtonElement>('.sortable-selection')
            [target]?.focus()
        }}
      >
        {index + 1}. {item.label}
      </Button>
    </li>
  )
}
export default function SortableList(props: Props) {
  const [announcement, setAnnouncement] = useState('')
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return (
    <Tooltip.Provider>
      {props.actions && (
        <div
          className="action-row sortable-actions"
          role="group"
          aria-label="Operation actions"
        >
          {props.actions.map((action) => (
            <IconButton
              key={action.id}
              {...action}
              disabled={props.disabled || action.disabled}
            />
          ))}
        </div>
      )}
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || props.disabled) return
          const { source } = event.operation
          if (!isSortable(source) || source.initialIndex === source.index)
            return
          const item = props.items.find((item) => item.id === source.id)
          if (!item) return
          props.onMove(item.id, source.index)
          setAnnouncement(
            `${item.label}, position ${source.index + 1} of ${props.items.length}`,
          )
        }}
      >
        <ol className="sortable-list" aria-label={props.label}>
          {props.items.map((item, index) => (
            <Row
              key={item.id}
              {...props}
              item={item}
              index={index}
              reducedMotion={reducedMotion}
            />
          ))}
        </ol>
        <span className="sortable-announcement" role="status">
          {announcement}
        </span>
      </DragDropProvider>
    </Tooltip.Provider>
  )
}
