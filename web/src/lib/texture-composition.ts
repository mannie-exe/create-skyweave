import { createField } from './fields'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import SortableList, {
  type SortableAction,
} from '../components/ui/SortableList'

export type TextureOperation = {
  label?: string
  source: number[]
  target: number[]
  flip_u?: boolean
  flip_v?: boolean
  rotation?: number
  enabled?: boolean
}
export type TextureEdits = Record<string, TextureOperation[]>

/** Recipe operations only; Python owns sampling, validation and output. */
export class TextureCompositionEditor {
  private selected = 0
  private scope = ''
  private listHost = document.createElement('div')
  private inspectorHost = document.createElement('div')
  private listRoot = createRoot(this.listHost)
  private operationIds = new WeakMap<TextureOperation, string>()
  private nextId = 0
  constructor(
    private root: HTMLElement,
    private callbacks: {
      operations: () => TextureOperation[]
      replace: (operations: TextureOperation[]) => void
      changed: () => void
      locked: () => boolean
      scope?: () => string
    },
  ) {
    this.root.classList.add('texture-operation-workbench')
    this.root.replaceChildren(this.listHost, this.inspectorHost)
    window.addEventListener('pagehide', () => this.listRoot.unmount(), {
      once: true,
    })
  }
  private operationActions(): SortableAction[] {
    const operations = this.callbacks.operations(),
      count = operations.length
    return [
      {
        id: 'texture-operation-add',
        icon: 'add',
        label: 'Add region',
        disabled: count >= 32,
        onClick: () =>
          this.apply(
            [...operations, { source: [0, 0, 16, 16], target: [0, 0, 16, 16] }],
            count,
          ),
      },
      {
        id: 'texture-operation-duplicate',
        icon: 'copy',
        label: 'Duplicate region',
        disabled: !count || count >= 32,
        onClick: () => {
          const duplicate = structuredClone(operations[this.selected])
          if (duplicate.label)
            duplicate.label = `${duplicate.label.slice(0, 75)} copy`
          const next = [...operations]
          next.splice(this.selected + 1, 0, duplicate)
          this.apply(next, this.selected + 1)
        },
      },
      {
        id: 'texture-operation-up',
        icon: 'up',
        label: `Move up ${this.selected + 1}`,
        disabled: !count || this.selected === 0,
        onClick: () => this.moveOperation(this.selected, this.selected - 1),
      },
      {
        id: 'texture-operation-down',
        icon: 'down',
        label: `Move down ${this.selected + 1}`,
        disabled: !count || this.selected >= count - 1,
        onClick: () => this.moveOperation(this.selected, this.selected + 1),
      },
      {
        id: 'texture-operation-remove',
        icon: 'delete',
        label: `Remove region ${this.selected + 1}`,
        intent: 'destructive',
        disabled: !count,
        onClick: () => {
          const next = [...operations]
          next.splice(this.selected, 1)
          this.apply(
            next,
            Math.min(this.selected, Math.max(0, next.length - 1)),
          )
        },
      },
    ]
  }

  private apply(operations: TextureOperation[], selected: number) {
    if (this.callbacks.locked()) return
    this.selected = selected
    this.callbacks.replace(operations)
    this.callbacks.changed()
    this.render()
  }
  private moveOperation(from: number, to: number) {
    const operations = this.callbacks.operations()
    if (
      this.callbacks.locked() ||
      from === to ||
      from < 0 ||
      from >= operations.length ||
      to < 0 ||
      to >= operations.length
    )
      return
    const selected = operations[this.selected],
      next = [...operations]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    this.apply(next, next.indexOf(selected))
  }
  private operationId(operation: TextureOperation) {
    if (!this.operationIds.has(operation))
      this.operationIds.set(operation, `operation-${++this.nextId}`)
    return this.operationIds.get(operation)!
  }
  private renderList() {
    const operations = this.callbacks.operations()
    this.listRoot.render(
      createElement(SortableList, {
        label: 'Texture operations',
        actions: this.operationActions(),
        items: operations.map((operation) => ({
          id: this.operationId(operation),
          label: operation.label ?? 'Region copy',
          detail: `${operation.source.join(', ')} → ${operation.target.join(', ')}${operation.enabled === false ? ' · skipped' : ''}`,
        })),
        selected:
          operations[this.selected] &&
          this.operationId(operations[this.selected]),
        disabled: this.callbacks.locked(),
        onSelect: (id) =>
          this.selectOperation(
            operations.findIndex(
              (operation) => this.operationId(operation) === id,
            ),
          ),
        onMove: (id, index) =>
          this.moveOperation(
            operations.findIndex(
              (operation) => this.operationId(operation) === id,
            ),
            index,
          ),
      }),
    )
  }

  refresh() {
    const locked = this.callbacks.locked()
    for (const control of this.root.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    >('input, select')) {
      control.disabled = locked || control.dataset.unavailable === 'true'
    }
    this.renderList()
  }
  private selectOperation(index: number) {
    this.selected = index
    this.render()
  }

  render() {
    const operations = this.callbacks.operations()
    this.root
      .closest<HTMLElement>('#texture-composition-tools')
      ?.toggleAttribute('hidden', !operations.length)
    const scope = this.callbacks.scope?.() ?? ''
    if (scope !== this.scope) {
      this.scope = scope
      this.selected = 0
    }
    this.selected = Math.min(this.selected, Math.max(0, operations.length - 1))
    this.inspectorHost.replaceChildren(
      ...operations.flatMap((operation, index) => {
        if (index !== this.selected) return []
        const group = document.createElement('fieldset')
        group.className = 'content-stack'
        const legend = document.createElement('legend')
        legend.textContent = `Region ${index + 1}`
        group.append(legend)
        const label = document.createElement('input')
        label.id = 'texture-operation-label'
        label.value = operation.label ?? ''
        label.maxLength = 80
        label.addEventListener('input', () => {
          if (label.value.trim()) operation.label = label.value
          else delete operation.label
          this.callbacks.changed()
        })
        label.addEventListener('change', () => this.render())
        group.append(createField('Operation name', label))
        for (const [key, title] of [
          ['source', 'Source UV'],
          ['target', 'Destination UV'],
        ] as const) {
          const fields = document.createElement('div')
          fields.className = 'model-fields texture-region-fields'
          const label = document.createElement('h4')
          label.textContent = title
          label.dataset.textRole = 'group-title'
          group.append(label, fields)
          for (const [i, name] of [
            'U start',
            'V start',
            'U end',
            'V end',
          ].entries()) {
            const input = document.createElement('input')
            input.id = `texture-region-${index}-${key}-${i}`
            input.type = 'number'
            input.min = '0'
            input.max = '16'
            input.step = 'any'
            input.value = String(operation[key][i])
            input.addEventListener('input', () => {
              if (
                !input.checkValidity() ||
                !Number.isFinite(input.valueAsNumber)
              )
                return
              operation[key][i] = input.valueAsNumber
              this.callbacks.changed()
            })
            fields.append(createField(name, input))
          }
        }
        const row = document.createElement('div')
        row.className = 'action-row'
        for (const [key, title] of [
          ['enabled', 'Enabled'],
          ['flip_u', 'Flip U'],
          ['flip_v', 'Flip V'],
        ] as const) {
          const input = document.createElement('input'),
            label = document.createElement('label')
          input.type = 'checkbox'
          input.checked = operation[key] ?? key === 'enabled'
          input.addEventListener('change', () => {
            operation[key] = input.checked
            this.callbacks.changed()
          })
          label.className = 'inline-field'
          label.append(input, title)
          row.append(label)
        }
        const rotation = document.createElement('select')
        rotation.id = `texture-rotation-${index}`
        rotation.append(
          ...[0, 90, 180, 270].map(
            (value) => new Option(`${value}°`, String(value)),
          ),
        )
        rotation.value = String(operation.rotation ?? 0)
        rotation.addEventListener('change', () => {
          operation.rotation = Number(rotation.value)
          this.callbacks.changed()
        })
        group.append(row, createField('Clockwise rotation', rotation))

        return group
      }),
    )
    if (!operations.length) {
      const text = document.createElement('p')
      text.textContent = 'No region edits.'
      text.dataset.textRole = 'caption'
      this.inspectorHost.append(text)
    }
    this.refresh()
  }
}
