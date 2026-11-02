import { families } from './progression.mjs'
import {
  depthBands,
  depthLabel,
  bandsInView,
  familyBands,
} from './map-depths.mjs'
import '../styles/map-orientation.css'

type Item = {
  id: string
  depth: number | null
  x: number
  y: number
  family?: string
}
type Band = {
  key: string
  depth: number | null
  x1: number
  x2: number
  items: Item[]
}

// The map controller supplies filtered items and scale; orientation follows the
// chosen policy layout without duplicating its placement or filtering rules.
export function mapOrientation(
  host: HTMLElement,
  viewport: HTMLElement,
  items: Item[],
) {
  const bands: Band[] = depthBands(items)
  let cellWidth = 1,
    cellHeight = 1,
    matches = new Map<string, Item[]>(),
    current = ''
  host.className = 'map-orientation'
  host.innerHTML = `<div class="orientation-controls"><strong data-text-role="label">Acquisition depth</strong><div class="orientation-navigation"><button type="button" data-depth-prev aria-label="Previous populated depth">←</button><select aria-label="Jump to depth"></select><button type="button" data-depth-next aria-label="Next populated depth">→</button></div></div><div class="orientation-ruler" aria-label="Depth bands"></div>`
  const rows = familyBands(items)
  const familyHost = document.getElementById('family-axis')!
  familyHost.replaceChildren()
  const familySelect = document.getElementById(
    'family-jump',
  ) as HTMLSelectElement
  familySelect.replaceChildren()
  const familyButtons = new Map<string, HTMLButtonElement>()
  let filteredItems: Item[] = []
  for (const band of rows) {
    familySelect.add(
      new Option(families[band.key as keyof typeof families], band.key),
    )
    const button = document.createElement('button')
    button.className = 'ui-button'
    button.type = 'button'
    button.dataset.familyBand = band.key
    const label = document.createElement('span')
    button.append(label)
    button.onclick = () => jumpFamily(band.key)
    familyHost.append(button)
    familyButtons.set(band.key, button)
  }
  function jumpFamily(key: string) {
    const first = filteredItems
      .filter((n) => n.family === key)
      .sort((a, b) => a.x - b.x || a.y - b.y)[0]
    if (!first) return
    viewport.scrollTo({
      top: first.y * cellHeight,
      left: Math.max(0, first.x * cellWidth - 20),
      behavior: 'instant',
    })
    render()
  }
  familySelect.onchange = () => jumpFamily(familySelect.value)
  const ruler = host.querySelector<HTMLElement>('.orientation-ruler')
  const select = host.querySelector<HTMLSelectElement>('select')
  const previous = host.querySelector<HTMLButtonElement>('[data-depth-prev]')!
  const next = host.querySelector<HTMLButtonElement>('[data-depth-next]')!
  const buttons = new Map<string, HTMLButtonElement>()
  for (const band of bands) {
    if (ruler) {
      const button = document.createElement('button')
      button.className = 'ui-button'
      button.type = 'button'
      button.dataset.depthBand = band.key
      const label = document.createElement('span')
      label.className = 'orientation-band-label'
      button.append(label)
      button.addEventListener('click', () => jump(band))
      ruler.append(button)
      buttons.set(band.key, button)
    }
    if (select) select.add(new Option(depthLabel(band.depth), band.key))
  }
  function populated() {
    return bands.filter((b) => matches.get(b.key)?.length)
  }
  function jump(band: Band) {
    const first = matches.get(band.key)?.[0]
    if (!first) return
    const cw = cellWidth
    viewport.scrollTo({
      left: Math.max(
        0,
        ((band.x1 + band.x2) / 2) * cw - viewport.clientWidth / 2,
      ),
      top: Math.max(0, first.y * cellHeight),
      behavior: 'instant',
    })
    render()
  }
  function neighbor(offset: number) {
    const active = bands.find((b) => b.key === current)
    if (!active) return undefined
    return offset < 0
      ? populated()
          .filter((b) => b.x1 < active.x1)
          .at(-1)
      : populated().find((b) => b.x1 > active.x1)
  }
  function move(offset: number) {
    const band = neighbor(offset)
    if (band) jump(band)
  }
  previous.addEventListener('click', () => move(-1))
  next.addEventListener('click', () => move(1))
  select?.addEventListener('change', () => {
    const band = bands.find((b) => b.key === select.value)
    if (band) jump(band)
  })
  function render() {
    const cw = cellWidth,
      left = viewport.scrollLeft,
      width = viewport.clientWidth
    const visible: Band[] = bandsInView(bands, left, width, cw)
    const available = populated()
    const center = (left + width / 2) / cw
    const populatedInView = visible.filter((b) => matches.get(b.key)?.length)
    const nearest = [
      ...(populatedInView.length ? populatedInView : bands),
    ].sort(
      (a, b) =>
        Math.abs((a.x1 + a.x2) / 2 - center) -
        Math.abs((b.x1 + b.x2) / 2 - center),
    )[0]
    current = available.length ? (nearest?.key ?? '') : ''
    previous.disabled = !neighbor(-1)
    next.disabled = !neighbor(1)
    if (select) {
      select.disabled = !available.length
      select.value = current
    }
    for (const band of bands) {
      const button = buttons.get(band.key)
      if (!button) continue
      button.style.left = `${band.x1 * cw - left}px`
      button.style.width = `${(band.x2 - band.x1) * cw}px`
      button.hidden = !visible.includes(band)
      button.setAttribute('aria-current', String(band.key === current))
      button.style.setProperty(
        '--band-inset',
        `${Math.max(0, left - band.x1 * cw)}px`,
      )
    }
    const top = viewport.scrollTop
    const activeFamily = rows.find(
      (b) =>
        b.y2 * cellHeight > top &&
        filteredItems.some((n) => n.family === b.key),
    )
    familySelect.disabled = !filteredItems.length
    familySelect.value = activeFamily?.key ?? ''
    for (const band of rows) {
      const button = familyButtons.get(band.key)!
      button.style.top = `${band.y1 * cellHeight - top}px`
      button.style.height = `${(band.y2 - band.y1) * cellHeight}px`
      button.style.setProperty(
        '--family-inset',
        `${Math.max(0, top - band.y1 * cellHeight)}px`,
      )
      button.hidden =
        band.y2 * cellHeight <= top ||
        band.y1 * cellHeight >= top + viewport.clientHeight
      button.setAttribute(
        'aria-current',
        String(activeFamily?.key === band.key),
      )
    }
    const inView = visible.map((b) => depthLabel(b.depth)).join(' · ')
    host.dataset.currentDepth = current
    host.dataset.visibleDepths = visible.map((b) => b.key).join(',')
    document.getElementById('position')!.textContent = available.length
      ? `${inView || 'Between depth bands'} · row ${Math.floor(viewport.scrollTop / cellHeight)} · ${activeFamily ? families[activeFamily.key as keyof typeof families] : ''}`
      : 'No matching items'
  }
  return {
    update(filtered: Item[], width: number, height: number) {
      filteredItems = filtered
      for (const band of rows) {
        const count = filtered.filter((n) => n.family === band.key).length
        const label = `${families[band.key as keyof typeof families]} · ${count.toLocaleString('en-US')}`
        const button = familyButtons.get(band.key)!
        button.querySelector('span')!.textContent = label
        button.disabled = !count
        const option = Array.from(familySelect.options).find(
          (o) => o.value === band.key,
        )!
        option.textContent = label
        option.disabled = !count
      }
      cellWidth = width
      cellHeight = height
      matches = new Map()
      for (const item of filtered) {
        const key = item.depth === null ? 'none' : String(item.depth)
        if (!matches.has(key)) matches.set(key, [])
        matches.get(key)!.push(item)
      }
      for (const group of matches.values())
        group.sort((a, b) => a.y - b.y || a.x - b.x)
      for (const band of bands) {
        const count = matches.get(band.key)?.length ?? 0
        const text = `${depthLabel(band.depth)} · ${count.toLocaleString('en-US')} item${count === 1 ? '' : 's'}`
        const button = buttons.get(band.key)
        if (button) {
          button.disabled = !count
          button.querySelector('span')!.textContent = text
          button.title = `${text} match current filters. Jump to first matching row.`
        }
        const option = select?.querySelector<HTMLOptionElement>(
          `option[value="${band.key}"]`,
        )
        if (option) {
          option.textContent = text
          option.disabled = !count
        }
      }
      render()
    },
    render,
  }
}
