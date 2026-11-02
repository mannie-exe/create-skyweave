import { readColorTokens } from './style-tokens'
import type { TextureSource } from './model-preview'

export type MaterialMask = {
  kind: 'material'
  palette?: number[][]
  tolerance?: number
  regions?: number[][]
  include?: number[][]
  exclude?: number[][]
}
export type MaskPlane = { mask?: MaterialMask | { kind: 'alpha' } }
type MaskPreview = { pixels: number[][]; width: number; height: number }
const byId = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

/** Edits explicit source selections; the Python engine computes the actual mask. */
export class MaterialMaskEditor {
  private cursor = [0, 0]
  private start: number[] | undefined
  private last: number[] | undefined
  private source = document.createElement('canvas')
  private image?: HTMLImageElement
  private texture?: TextureSource
  private tool = byId<HTMLSelectElement>('mask-tool')
  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: {
      plane: () => MaskPlane | undefined
      preview: () => MaskPreview | undefined
      changed: () => void
      draw: () => void
      locked: () => boolean
    },
  ) {
    byId<HTMLInputElement>('mask-tolerance').addEventListener(
      'input',
      (event) => {
        const input = event.currentTarget as HTMLInputElement
        if (!input.checkValidity() || !Number.isInteger(input.valueAsNumber))
          return
        this.mask().tolerance = input.valueAsNumber
        this.change()
      },
    )
    byId('mask-clear-colors').addEventListener('click', () => {
      this.mask().palette = []
      this.change()
    })
    byId('mask-reset-corrections').addEventListener('click', () => {
      this.mask().include = []
      this.mask().exclude = []
      this.change()
    })
    for (const id of ['mask-show-grid', 'mask-show-overlay'])
      byId(id).addEventListener('change', callbacks.draw)
    canvas.tabIndex = 0
    canvas.setAttribute('aria-describedby', 'mask-status')
    canvas.addEventListener('keydown', (event) => {
      if (!this.active() || callbacks.locked()) return
      const delta: Record<string, number[]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      if (delta[event.key]) {
        event.preventDefault()
        this.cursor = this.clamp(
          this.cursor.map((n, i) => n + delta[event.key][i]),
        )
        this.refresh()
        callbacks.draw()
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        this.apply(this.cursor)
        this.change()
      }
    })
  }
  private mask(): MaterialMask {
    const mask = this.callbacks.plane()?.mask
    if (mask?.kind !== 'material')
      throw new Error('Select a material mask first')
    return mask
  }
  active() {
    return this.callbacks.plane()?.mask?.kind === 'material'
  }
  clearSource() {
    this.image = undefined
    this.texture = undefined
    this.cancel()
  }
  setSource(image: HTMLImageElement, texture: TextureSource) {
    this.image = image
    this.texture = texture
    this.source.width = texture.width
    this.source.height = texture.frameHeight
    this.source.getContext('2d')!.drawImage(image, 0, 0)
    this.cursor = this.clamp(this.cursor)
    this.refresh()
  }
  private clamp(point: number[]) {
    return point.map((n, i) =>
      Math.max(
        0,
        Math.min(
          (i === 0 ? this.texture?.width : this.texture?.frameHeight)! - 1,
          n,
        ),
      ),
    )
  }
  private point(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    return this.clamp([
      Math.floor(
        ((event.clientX - rect.left) / rect.width) * this.texture!.width,
      ),
      Math.floor(
        ((event.clientY - rect.top) / rect.height) * this.texture!.frameHeight,
      ),
    ])
  }
  private apply(point: number[]) {
    const mask = this.mask()
    if (this.tool.value === 'pick') {
      const rgb = [
        ...this.source.getContext('2d')!.getImageData(point[0], point[1], 1, 1)
          .data,
      ].slice(0, 3)
      if (
        !(mask.palette ?? []).some((color) =>
          color.every((n, i) => n === rgb[i]),
        )
      )
        mask.palette = [...(mask.palette ?? []), rgb]
    } else if (this.tool.value === 'include' || this.tool.value === 'exclude') {
      const field = this.tool.value,
        opposite = field === 'include' ? 'exclude' : 'include'
      const same = (p: number[]) => p[0] === point[0] && p[1] === point[1]
      mask[opposite] = (mask[opposite] ?? []).filter((p) => !same(p))
      if (!(mask[field] ?? []).some(same))
        mask[field] = [...(mask[field] ?? []), [...point]]
    }
  }
  private change() {
    this.callbacks.changed()
    this.refresh()
    this.callbacks.draw()
  }
  down(event: PointerEvent) {
    if (!this.active() || this.tool.value === 'crop') return false
    if (
      this.callbacks.locked() ||
      !this.image ||
      event.button !== 0 ||
      !event.isPrimary
    )
      return true
    this.start = this.last = this.cursor = this.point(event)
    this.canvas.setPointerCapture(event.pointerId)
    if (this.tool.value !== 'region') this.apply(this.cursor)
    this.refresh()
    this.callbacks.draw()
    return true
  }
  move(event: PointerEvent) {
    if (!this.start || !this.canvas.hasPointerCapture(event.pointerId)) return
    const next = this.point(event)
    if (['include', 'exclude'].includes(this.tool.value)) {
      const previous = this.last!,
        steps = Math.max(...next.map((n, i) => Math.abs(n - previous[i])))
      for (let step = 1; step <= steps; step++)
        this.apply(
          next.map((n, i) =>
            Math.round(previous[i] + ((n - previous[i]) * step) / steps),
          ),
        )
    }
    this.last = this.cursor = next
    this.refresh()
    this.callbacks.draw()
  }
  up(event: PointerEvent) {
    if (!this.start) return false
    const end = this.point(event)
    if (this.tool.value === 'region')
      this.mask().regions = [
        ...(this.mask().regions ?? []),
        [
          Math.min(this.start[0], end[0]),
          Math.min(this.start[1], end[1]),
          Math.max(this.start[0], end[0]) + 1,
          Math.max(this.start[1], end[1]) + 1,
        ],
      ]
    this.start = this.last = undefined
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId)
    this.change()
    return true
  }
  cancel() {
    this.start = this.last = undefined
  }
  refresh() {
    const active = this.active()
    byId('material-mask-tools').hidden = !active
    byId('material-mask-tools')
      .closest('.model-previews')!
      .setAttribute('data-mask-active', String(active))
    if (!active) return
    const mask = this.mask()
    byId<HTMLInputElement>('mask-tolerance').value = String(mask.tolerance ?? 0)
    const palette = byId('mask-palette')
    palette.replaceChildren(
      ...(mask.palette ?? []).map((color, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'ui-button mask-color'
        button.dataset.intent = 'destructive'
        const hex =
          '#' + color.map((n) => n.toString(16).padStart(2, '0')).join('')
        button.style.setProperty('--mask-swatch', hex)
        button.textContent = hex + ' ×'
        button.setAttribute('aria-label', `Remove sampled color ${hex}`)
        button.addEventListener('click', () => {
          mask.palette!.splice(index, 1)
          this.change()
        })
        return button
      }),
    )
    if (!palette.childElementCount) palette.textContent = 'No sampled colors'
    byId('mask-regions').replaceChildren(
      ...(mask.regions ?? []).map((region, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'ui-button'
        button.dataset.intent = 'destructive'
        button.textContent = `Remove region ${region.join(', ')}`
        button.addEventListener('click', () => {
          mask.regions!.splice(index, 1)
          this.change()
        })
        return button
      }),
    )
    if (!byId('mask-regions').childElementCount)
      byId('mask-regions').textContent = 'Full UV crop'
    for (const field of byId('material-mask-tools').querySelectorAll<
      HTMLButtonElement | HTMLInputElement | HTMLSelectElement
    >('button, input, select'))
      field.disabled = this.callbacks.locked()
    byId('mask-status').textContent =
      `${this.callbacks.preview()?.pixels.length ?? 0} pixels in last valid mask · cursor ${this.cursor.join(', ')} · ${(mask.include ?? []).length} included / ${(mask.exclude ?? []).length} excluded`
  }
  draw(context: CanvasRenderingContext2D) {
    if (!this.active() || !this.texture) return
    const size = this.canvas.width,
      dx = size / this.texture.width,
      dy = size / this.texture.frameHeight
    const colors = readColorTokens(this.canvas, {
      selection: '--color-action',
      grid: '--line-subtle',
    })
    if (byId<HTMLInputElement>('mask-show-overlay').checked) {
      context.fillStyle = colors.selection
      context.globalAlpha = 0.4
      for (const [x, y] of this.callbacks.preview()?.pixels ?? [])
        context.fillRect(x * dx, y * dy, dx, dy)
      context.globalAlpha = 1
    }
    if (byId<HTMLInputElement>('mask-show-grid').checked) {
      context.strokeStyle = colors.grid
      context.lineWidth = 0.5
      context.beginPath()
      for (let x = 0; x <= this.texture.width; x++) {
        context.moveTo(x * dx, 0)
        context.lineTo(x * dx, size)
      }
      for (let y = 0; y <= this.texture.frameHeight; y++) {
        context.moveTo(0, y * dy)
        context.lineTo(size, y * dy)
      }
      context.stroke()
    }
    context.strokeStyle = colors.selection
    context.lineWidth = 2
    for (const [x0, y0, x1, y1] of this.mask().regions ?? [])
      context.strokeRect(x0 * dx, y0 * dy, (x1 - x0) * dx, (y1 - y0) * dy)
    if (document.activeElement === this.canvas)
      context.strokeRect(this.cursor[0] * dx, this.cursor[1] * dy, dx, dy)
  }
}
