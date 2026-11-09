import { notify } from './activity'
import { setFeedback } from './ui'
import { mapOrientation } from './map-orientation'
import { recipeMounts } from './recipe-mount'
import { requestJSON as fetchJSON } from './http'
import { workspaceClient, WorkspaceClientError } from './workspace/client'
import { observeWorkspaceChanges } from './workspace/changes'
import { scrollNavigation } from './minimap'
import { readColorTokens } from './style-tokens'
import { coverageStates, coverageStatus } from './coverage.mjs'
import '../styles/recipes.css'
import '../styles/item-details.css'
import { recipePresentation, safeIcon } from './recipe-view.mjs'
import { detailBucket, layout } from './graph.mjs'
import { clearRouteData } from './route-data'
import { renderStructureSurvey } from './structures'
import { renderIslandSurvey } from './islands'
import { oreProfile } from './world-profile.mjs'
const detailRecipes = recipeMounts(),
  evidenceRecipes = recipeMounts()
type Node = {
  id: string
  name: string
  mod: string
  kind: string
  icon: string | null
  family: string
  progression?: Record<string, any>
  depth: number | null
  x: number
  y: number
  recipeCount: number
  usesCount: number
  hasNote: boolean
  status: string
  routeCount: number
}
type RecordData = Record<string, any>
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T
const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )
const pretty = (value: unknown) =>
  `<pre>${escape(JSON.stringify(value, null, 2))}</pre>`
const nf = new Intl.NumberFormat('en-US')
let nodes: Node[] = [],
  filtered: Node[] = [],
  meta: RecordData = {},
  domainData: RecordData | null = null,
  world: RecordData | null = null
let scale = 1,
  selected = '',
  renderQueued = false,
  editorFiles: RecordData = {},
  domainReady = false
const editorDrafts = new Map<string, { text: string; revision: string }>()
let itemCatalog = new Map<string, Node>()
let orientation: ReturnType<typeof mapOrientation> | undefined
let orientationSource: Node[] | undefined
let acquisitionView:
  { destroy(): void; setPolicy(policy: string): void } | undefined
const inspectorHistory: string[] = []
const detailCache = new Map<string, RecordData>()
const viewport = el('viewport'),
  grid = el('grid'),
  tooltip = el('tooltip')
const mapNavigation = scrollNavigation(
  viewport,
  el<HTMLCanvasElement>('map-minimap'),
)
const notice = notify
async function loadCatalog() {
  const preserveViewport = nodes.length > 0
  clearRouteData()
  const data = await fetchJSON('/generated/catalog.json')
  nodes = data.nodes
  applyPolicy()
  itemCatalog = new Map(nodes.map((n) => [n.id, n]))
  meta = data.meta
  el('snapshot').textContent =
    `MC ${meta.minecraft} · ${String(meta.capturedAt).slice(0, 10)}\n${String(meta.lockSha256).slice(0, 12)}`
  const select = el<HTMLSelectElement>('mod-filter'),
    previous = select.value
  select.innerHTML =
    '<option value="">All mods</option>' +
    [...new Set(nodes.map((n) => n.mod))]
      .sort()
      .map((mod) => `<option>${escape(mod)}</option>`)
      .join('')
  select.value = previous
  const environment = meta.environment
  const summary = el('environment-summary')
  summary.hidden = !environment
  if (environment) {
    const names: Record<string, string> = {
      'minecraft:overworld': 'Overworld',
      'minecraft:the_nether': 'Nether',
      'minecraft:the_end': 'The End',
    }
    const restrictions = Object.values(environment.dimensions ?? {})
      .filter((dimension: any) => dimension.state !== 'potential')
      .map(
        (dimension: any) =>
          `${names[dimension.id] ?? dimension.id} ${dimension.state === 'blocked' ? 'closed' : 'unclassified'}`,
      )
    summary.textContent = `${environment.context} pack defaults${restrictions.length ? ' · ' + restrictions.join(' · ') : ''}. Sources are conditional declarations, not guaranteed supplies.`
  }
  el('coverage-summary').innerHTML = [
    'mapped',
    'blocked',
    'unmapped',
    'unknown',
    'excluded',
    'unified',
  ]
    .map(
      (key) =>
        `<button class="ui-button subtle" data-coverage="${key}">${nf.format(meta.counts[key] ?? 0)} ${key === 'unmapped' ? 'no adapter' : key === 'excluded' ? 'internal / creative' : key === 'unknown' ? 'unclassified' : key}</button>`,
    )
    .join('')
  el('coverage-summary')
    .querySelectorAll<HTMLElement>('[data-coverage]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        el<HTMLSelectElement>('route-filter').value =
          button.dataset.coverage === 'mapped'
            ? 'known'
            : button.dataset.coverage!
        filter()
      }),
    )
  filter(preserveViewport)
}
function applyPolicy() {
  const policy = el<HTMLSelectElement>('progression-policy').value
  nodes = layout(
    nodes.map((n) => ({
      ...n,
      depth: n.progression?.[policy] ? n.progression[policy].depth : n.depth,
      family: n.progression?.[policy]?.family ?? n.family,
    })),
  )
  itemCatalog = new Map(nodes.map((n) => [n.id, n]))
}
el('progression-policy').addEventListener('change', () => {
  applyPolicy()
  viewport.scrollTo(0, 0)
  filter()
  acquisitionView?.setPolicy(el<HTMLSelectElement>('progression-policy').value)
})
function filter(preserveViewport = false) {
  const query = el<HTMLInputElement>('search').value.toLowerCase(),
    mod = el<HTMLSelectElement>('mod-filter').value,
    route = el<HTMLSelectElement>('route-filter').value
  filtered = nodes.filter(
    (n) =>
      (!query || `${n.id} ${n.name}`.toLowerCase().includes(query)) &&
      (!mod || n.mod === mod) &&
      (!route ||
        (route === 'known' && n.status === 'mapped') ||
        (route === 'unresolved' &&
          ['blocked', 'unmapped', 'unknown'].includes(n.status)) ||
        (route === 'notes' && n.hasNote) ||
        route === n.status),
  )
  el('counts').textContent =
    `${nf.format(filtered.length)} / ${nf.format(nodes.length)} items · ${nf.format(meta.counts?.recipes ?? 0)} runtime recipes`
  grid.style.width = `${(Math.max(0, ...filtered.map((n) => n.x)) + 1) * 108 * scale}px`
  grid.style.height = `${(Math.max(0, ...filtered.map((n) => n.y)) + 1) * 100 * scale}px`
  grid.style.backgroundSize = `${108 * scale}px ${100 * scale}px`
  if (!preserveViewport && (query || mod || route)) {
    const first = filtered[0]
    if (first) {
      viewport.scrollLeft = Math.max(0, first.x * 108 * scale - 25)
      viewport.scrollTop = Math.max(0, first.y * 100 * scale - 25)
    }
  }
  const palette = readColorTokens(
    viewport,
    Object.fromEntries(
      Object.entries(coverageStates).map(([status, state]) => [
        status,
        state.token as `--${string}`,
      ]),
    ),
  )
  if (orientationSource !== nodes) {
    orientation = mapOrientation(el('map-orientation'), viewport, nodes)
    orientationSource = nodes
  }
  orientation?.update(filtered, 108 * scale, 100 * scale)
  mapNavigation.setScene(
    { x1: 0, y1: 0, x2: grid.offsetWidth, y2: grid.offsetHeight },
    filtered.map((n) => ({
      x: (n.x + 0.5) * 108 * scale,
      y: (n.y + 0.5) * 100 * scale,
      color: palette[coverageStatus(n.status)],
    })),
  )
  render()
}
function render() {
  renderQueued = false
  mapNavigation.draw()
  const cw = 108 * scale,
    ch = 100 * scale,
    left = viewport.scrollLeft,
    top = viewport.scrollTop
  const visible = filtered.filter(
    (n) =>
      n.x * cw > left - cw &&
      n.x * cw < left + viewport.clientWidth + cw &&
      n.y * ch > top - ch &&
      n.y * ch < top + viewport.clientHeight + ch,
  )
  grid.innerHTML = visible
    .map(
      (n) =>
        `<button class="cell ${n.id === selected ? 'selected' : ''} ${n.hasNote ? 'has-note' : ''}" data-id="${escape(n.id)}" data-coverage="${coverageStatus(n.status)}" role="gridcell" aria-selected="${n.id === selected}" aria-label="${escape(n.name)}; ${coverageStates[coverageStatus(n.status)].label}${n.depth === null ? '' : `; route depth ${n.depth}`}${n.hasNote ? '; review note' : ''}" style="left:${n.x * cw}px;top:${n.y * ch}px;width:${cw}px;height:${ch}px">${safeIcon(n.icon) ? `<img src="${n.icon}" alt="" loading="lazy" style="width:${36 * scale}px;height:${36 * scale}px"/>` : '<span class="fallback">◇</span>'}<span class="caption" style="font-size:${10 * scale}px">${escape(n.name)}</span><span class="namespace" style="font-size:${8 * scale}px">${escape(n.mod)}</span>${n.hasNote ? '<i class="note-indicator" aria-hidden="true"></i>' : ''}</button>`,
    )
    .join('')
  el('position').textContent =
    `X ${Math.round(left / cw)} / Y ${Math.round(top / ch)}`
  orientation?.render()
}
function queueRender() {
  if (!renderQueued) {
    renderQueued = true
    requestAnimationFrame(render)
  }
}
viewport.addEventListener('scroll', () => {
  tooltip.hidden = true
  queueRender()
})
viewport.addEventListener(
  'wheel',
  (event) => {
    if (event.shiftKey && event.deltaY) {
      event.preventDefault()
      viewport.scrollLeft += event.deltaY
    }
  },
  { passive: false },
)
new ResizeObserver(queueRender).observe(viewport)
const viewTabs = document.querySelector<HTMLElement>('.view-tabs')!
function positionInspector() {
  el('inspector').style.setProperty(
    '--inspector-top',
    `${Math.max(0, viewTabs.getBoundingClientRect().bottom)}px`,
  )
}
const navigationSize = new ResizeObserver(positionInspector)
navigationSize.observe(viewTabs)
navigationSize.observe(document.querySelector('.topbar')!)
window.addEventListener('scroll', positionInspector, { passive: true })
positionInspector()
grid.addEventListener('click', (event) => {
  const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')
  if (cell) inspect(cell.dataset.id!)
})
grid.addEventListener('pointerover', (event) => {
  const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')
  if (!cell || !el('inspector').hidden) return
  const node = nodes.find((n) => n.id === cell.dataset.id)
  if (!node) return
  tooltip.textContent = `${node.name}\n${node.id}\n${node.depth === null ? coverageStates[coverageStatus(node.status)].label : `${el<HTMLSelectElement>('progression-policy').selectedOptions[0].text} · depth ${node.depth}`} · ${node.recipeCount} producing recipes · ${node.usesCount} uses\nClick for sources, conditions, drops and configuration.`
  const rect = cell.getBoundingClientRect()
  tooltip.style.left = `${Math.min(rect.right + 8, window.innerWidth - 365)}px`
  tooltip.style.top = `${Math.min(rect.top, window.innerHeight - 160)}px`
  tooltip.hidden = false
})
grid.addEventListener('pointerout', (event) => {
  if (!(event.relatedTarget as HTMLElement)?.closest?.('[data-id]'))
    tooltip.hidden = true
})
for (const id of ['search', 'mod-filter', 'route-filter'])
  el(id).addEventListener('input', () => filter())
el<HTMLInputElement>('zoom').addEventListener('input', (event) => {
  const old = scale
  scale = Number((event.target as HTMLInputElement).value)
  viewport.scrollLeft = (viewport.scrollLeft / old) * scale
  viewport.scrollTop = (viewport.scrollTop / old) * scale
  filter()
})
el('reset-map').addEventListener('click', () => {
  viewport.scrollTo(0, 0)
})
el('layout-help').addEventListener('click', () =>
  notice(
    'Columns follow the selected access policy. Rows group the chosen method into acquisition families; other methods remain in item details. Planned access prefers fewer opportunistic-source stages, then fewer unknown-chance stages, then fewer chance stages, then depth. Earliest access minimizes depth alone. Quality counts include prerequisite branches; shared earlier setup can count more than once. Neither policy measures playtime or proves a working production chain. Filters preserve positions.',
  ),
)
el('close-inspector').addEventListener('click', () => {
  el('inspector').hidden = true
  acquisitionView?.destroy()
  acquisitionView = undefined
  selected = ''
  render()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    el('inspector').hidden = true
    acquisitionView?.destroy()
    acquisitionView = undefined
    tooltip.hidden = true
  }
  if (
    event.key === '/' &&
    !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)
  ) {
    event.preventDefault()
    el(el('graph-view').hidden ? 'search' : 'graph-search').focus()
  }
})
function sourceLinks(sources: unknown[] = []) {
  return sources
    .map((source) =>
      typeof source === 'string' && /^https:\/\//.test(source)
        ? `<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">${escape(source)}</a>`
        : escape(typeof source === 'string' ? source : JSON.stringify(source)),
    )
    .join('<br/>')
}
function recipeHTML(recipe: RecordData, open = false) {
  const view = recipePresentation(recipe)
  const type = view.type.split(':').at(-1).replaceAll('_', ' ')
  const output = view.derivedOutput
    ? 'Armor trim'
    : recipe.output && recipe.output !== 'minecraft:air'
      ? (itemCatalog.get(recipe.output)?.name ?? recipe.id)
      : recipe.id
  return `<details class="record recipe-record disclosure"${open ? ' open' : ''}><summary><span>${escape(output)}</span><span class="record-kind">${escape(type)}</span><small>${escape(recipe.id)}</small></summary><div class="content-stack"><div data-recipe-host="${escape(recipe.id)}"></div></div></details>`
}
async function inspect(id: string, back = false) {
  const node = nodes.find((n) => n.id === id)
  if (!node) {
    notice(`No registered item: ${id}`)
    return
  }
  if (!back && selected && selected !== id) {
    inspectorHistory.push(selected)
    if (inspectorHistory.length > 30) inspectorHistory.shift()
  }
  acquisitionView?.destroy()
  acquisitionView = undefined
  selected = id
  tooltip.hidden = true
  el('inspector').hidden = false
  detailRecipes.clear()
  el('detail').innerHTML = '<p class="muted">Loading item…</p>'
  render()
  try {
    const key = node.mod + '/' + detailBucket(id)
    if (!detailCache.has(key))
      detailCache.set(key, await fetchJSON(`/generated/details/${key}.json`))
    if (selected !== id) return
    const detail = detailCache.get(key)![id]
    const section = (key: string, label: string, body: string) =>
      `<section data-detail-panel="${key}"${key === 'acquisition' ? '' : ' hidden'} aria-label="${label}">${body}</section>`
    const uses = `<h3 data-text-role="group-title">Used by · ${detail.uses.length} recipes</h3>
      ${detail.uses
        .slice(0, 80)
        .map((r: RecordData) => recipeHTML(r))
        .join('')}
      ${detail.uses.length > 80 ? '<p class="muted">First 80 shown; Evidence lists all active recipes.</p>' : ''}`
    const evidence = `<h3 data-text-role="group-title">Potential drops · ${detail.drops.length} tables</h3>
      ${detail.drops.map((drop: RecordData) => `<details class="record disclosure"><summary>${escape(drop.id)}</summary><div class="content-stack"><p class="muted">Conditions and functions determine actual drops.</p>${pretty(drop.json)}</div></details>`).join('')}
      <details class="record disclosure"><summary>Tags & tool requirements</summary><div class="content-stack">${pretty({ tags: detail.tags, block: detail.block })}</div></details>
      <details class="record disclosure"><summary>Interactions & implementation hooks</summary><div class="content-stack">${pretty({ transformations: detail.interactions, hooks: detail.hooks })}</div></details>
      <details class="record disclosure"><summary>Native interaction documentation</summary><div class="content-stack">${Object.keys(detail.ponder).length ? pretty(detail.ponder) : '<p>No matching Ponder text indexed.</p>'}</div></details>
      <details class="record disclosure"><summary>Registry and asset provenance</summary><div class="content-stack"><p class="muted">Extracted icons can differ from custom in-game rendering.</p>${pretty({ components: detail.components, stack: detail.stack, class: detail.class, icon: detail.icon })}</div></details>
      <button id="edit-item-note">Edit item notes in workspace</button>`
    el('detail').innerHTML = `
      ${inspectorHistory.length ? '<button id="item-back">← Back</button>' : ''}
      <nav class="detail-tabs" aria-label="Item information">
        <button class="ui-button" data-detail-tab="acquisition" aria-pressed="true">Acquisition</button>
        <button class="ui-button" data-detail-tab="uses" aria-pressed="false">Uses · ${detail.uses.length}</button>
        <button class="ui-button" data-detail-tab="evidence" aria-pressed="false">Evidence</button>
      </nav>
      <div class="item-detail-layout" data-active-panel="acquisition">
      <div class="item-subject">
      <header class="item-heading">
        ${safeIcon(node.icon) ? `<img class="detail-icon" src="${node.icon}" alt=""/>` : ''}
        <div><h2 data-text-role="item-title">${escape(node.name)}</h2><div class="id" data-text-role="code">${escape(id)}</div><span class="badge">${node.depth === null ? coverageStates[coverageStatus(node.status)].label : `DEPTH ${node.depth}`}</span></div>
      </header>
      ${detail.note ? `<details class="item-notes disclosure"><summary>Pack notes</summary><div class="content-stack"><div class="pack-note">${escape(detail.note.text)}<p>${sourceLinks(detail.note.sources)}</p></div></div></details>` : ''}
      </div>
      ${section('acquisition', 'Acquisition', '<div class="item-acquisition method-workbench"></div>')}
      ${section('uses', 'Uses', uses)}
      ${section('evidence', 'Evidence', evidence)}</div>`
    el('inspector').scrollTop = 0
    el('detail')
      .querySelectorAll<HTMLElement>('[data-detail-tab]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          el('detail').querySelector<HTMLElement>(
            '.item-detail-layout',
          )!.dataset.activePanel = button.dataset.detailTab
          el('detail')
            .querySelectorAll<HTMLElement>('[data-detail-tab]')
            .forEach((b) =>
              b.setAttribute('aria-pressed', String(b === button)),
            )
          el('detail')
            .querySelectorAll<HTMLElement>('[data-detail-panel]')
            .forEach(
              (panel) =>
                (panel.hidden =
                  panel.dataset.detailPanel !== button.dataset.detailTab),
            )
        }),
      )
    document.getElementById('item-back')?.addEventListener('click', () => {
      const previous = inspectorHistory.pop()
      if (previous) void inspect(previous, true)
    })
    detailRecipes.mount(
      el('detail'),
      detail.uses,
      itemCatalog,
      inspect,
      'semantic',
    )
    const host = el('detail').querySelector<HTMLElement>('.method-workbench')!
    const { mountAcquisition } = await import('./acquisition-mount')
    if (selected !== id || !host.isConnected) return
    const mounted = await mountAcquisition(
      host,
      nodes,
      detail,
      id,
      inspect,
      async () => {
        await showView('graph')
        graph?.openItem(
          id,
          true,
          el<HTMLSelectElement>('progression-policy').value,
        )
      },
      meta.environment?.dimensions,
    )
    if (selected !== id || !host.isConnected) {
      mounted.destroy()
      return
    }
    acquisitionView = mounted
    el('edit-item-note').addEventListener('click', () => {
      showView('editor')
      el<HTMLSelectElement>('edit-domain').value = 'items'
      loadEditor('items')
    })
  } catch (error) {
    el('detail').textContent = String(error)
  }
}
async function domains() {
  if (!domainData) domainData = await fetchJSON('/generated/domains.json')
  return domainData!
}
let graph: ReturnType<typeof import('./atlas-graph').createGraph> | undefined
let graphStale = true
let currentView = 'map'
async function showView(name: string) {
  currentView = name
  document
    .querySelectorAll<HTMLElement>('.view')
    .forEach((view) => (view.hidden = view.id !== name + '-view'))
  document
    .querySelectorAll<HTMLButtonElement>('button[data-view]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.view === name)),
    )
  el('inspector').hidden = true
  acquisitionView?.destroy()
  acquisitionView = undefined
  tooltip.hidden = true
  try {
    if (name === 'graph') {
      graph ??= (await import('./atlas-graph')).createGraph(inspect)
      if (graphStale) {
        await graph.load()
        graphStale = false
      }
    }
    if (name === 'world') await loadWorld()
    if (name === 'evidence') await loadEvidence()
    if (name === 'editor') await initEditor()
    if (name === 'map') render()
  } catch (error) {
    notice(String(error), { tone: 'error' })
  }
}
document
  .querySelectorAll<HTMLButtonElement>('button[data-view]')
  .forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view!))
    button.disabled = false
  })
let evidenceLimit = 100,
  evidenceRequest = 0
async function loadEvidence(reset = true) {
  const request = ++evidenceRequest
  if (reset) evidenceLimit = 100
  const data = await domains(),
    kind = el<HTMLSelectElement>('evidence-domain').value,
    query = el<HTMLInputElement>('evidence-search').value.toLowerCase()
  let rows: RecordData[] = []
  if (['recipes', 'loot'].includes(kind)) {
    if (!data[kind]) data[kind] = await fetchJSON(`/generated/${kind}.json`)
    rows = Array.isArray(data[kind])
      ? data[kind]
      : Object.entries(data[kind]).map(([id, json]) => ({ id, json }))
  } else if (kind === 'advancements')
    rows = Object.entries(data.advancements).map(([id, json]) => ({ id, json }))
  else if (kind === 'interactions')
    rows = [...data.authored.interactions.records, ...data.interactions]
  else if (kind === 'acquisition') rows = data.acquisition
  else if (data.authored[kind]?.records) rows = data.authored[kind].records
  else
    rows = (data[kind] ?? []).map((row: unknown) =>
      typeof row === 'string' ? { detail: row } : row,
    )
  if (request !== evidenceRequest) return
  const matches = rows.filter(
    (row) => !query || JSON.stringify(row).toLowerCase().includes(query),
  )
  el('evidence-count').textContent = `${nf.format(matches.length)} records`
  evidenceRecipes.clear()
  el('evidence-list').innerHTML = matches
    .slice(0, evidenceLimit)
    .map((row) =>
      kind === 'recipes'
        ? recipeHTML(row)
        : `<article class="record content-stack"><h3>${escape(row.title ?? row.id ?? row.tag ?? row.path ?? 'Diagnostic')}</h3>${row.status ? `<p>${escape(row.status)} · ${row.downstream} consuming routes</p>` : ''}${row.evidence ? `<span class="badge">${escape(row.evidence)}</span>` : ''}${row.detail ? `<p>${escape(row.detail)}</p>` : ''}${row.sources ? `<p class="sources">${sourceLinks(row.sources)}</p>` : ''}<details class="disclosure"><summary>Source data</summary><div class="content-stack">${pretty(row)}</div></details></article>`,
    )
    .join('')
  if (kind === 'recipes')
    evidenceRecipes.mount(
      el('evidence-list'),
      matches.slice(0, evidenceLimit),
      itemCatalog,
      inspect,
    )
  el('more-evidence').hidden = matches.length <= evidenceLimit
}
el('evidence-list').addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>(
    '[data-inspect]',
  )
  if (target) void inspect(target.dataset.inspect!)
})
for (const id of ['evidence-domain', 'evidence-search'])
  el(id).addEventListener('input', () => loadEvidence())
el('more-evidence').addEventListener('click', () => {
  evidenceLimit += 100
  loadEvidence(false)
})
async function loadWorld() {
  await renderStructureSurvey()
  await renderIslandSurvey()
  if (!world) world = await fetchJSON('/generated/world.json')
  el('world-layout').hidden = !world
  if (!world) {
    el('world-provenance').textContent = 'No saved-terrain evidence available.'
    el('world-summary').textContent = 'No world survey captured.'
    el('world-notes').textContent =
      'Run pnpm data:world, then pnpm data:compile. Terrain-derived acquisition routes are unavailable until a survey is captured.'
    return
  }
  const w = world!
  const captured = w.completedAt
    ? `Captured ${new Date(w.completedAt).toLocaleDateString('en', { dateStyle: 'medium' })}.`
    : 'Capture date not recorded.'
  el('world-provenance').textContent = w.provenance
    ? `${captured} Seed ${w.provenance.seed ?? 'not recorded'} · ${w.provenance.dimensionType ?? 'unknown dimension'}. ${w.sourceChangedDuringScan ? 'Source metadata changed during this scan.' : 'Recorded source identity; this is not a live view.'}`
    : `${captured} Legacy survey: world identity was not recorded. Do not use it to judge the current world.`
  el('world-summary').innerHTML = [
    ['Regions', w.regionCount],
    ['Populated chunks', w.populatedChunks],
    ['Sampled chunks', w.sampledChunks],
    [
      'Sample coverage',
      `${((100 * w.sampledChunks) / Math.max(1, w.populatedChunks)).toFixed(2)}%`,
    ],
    ['Read errors', w.errors.length],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><strong>${typeof value === 'number' ? nf.format(value) : escape(value)}</strong><small>${label}</small></div>`,
    )
    .join('')
  const oreSelect = el<HTMLSelectElement>('ore-map')
  if (oreSelect.options.length === 1)
    for (const ore of Object.keys(w.ores).sort())
      oreSelect.add(new Option(ore, ore))
  el('ore-table').innerHTML =
    '<div class="table-scroll"><table><thead><tr><th>Ore</th><th>Est. blocks/chunk</th><th>Approx. 95% interval</th></tr></thead><tbody>' +
    Object.entries(w.ores)
      .sort(
        ([, a], [, b]) =>
          (b as RecordData).estimatedPerChunk -
          (a as RecordData).estimatedPerChunk,
      )
      .map(([id, value]) => {
        const v = value as RecordData
        return `<tr><td><button class="ui-button ore-choice" data-ore="${escape(id)}" title="${escape(id)}">${escape(itemCatalog.get(id)?.name ?? id)}</button></td><td>${v.estimatedPerChunk.toFixed(4)}</td><td>${v.approx95PerChunk?.map((n: number) => n.toFixed(4)).join(' to ') ?? 'Not captured'}</td></tr>`
      })
      .join('') +
    '</tbody></table></div><p class="muted">Area-weighted estimates include void chunks. Intervals reflect sampling variance; sparse samples can miss rare ore entirely. These are not ore per stone block or a guarantee for one island.</p>'
  el('ore-table')
    .querySelectorAll<HTMLButtonElement>('[data-ore]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        oreSelect.value = button.dataset.ore!
        oreSelect.dispatchEvent(new Event('change'))
      }),
    )
  el('world-notes').innerHTML =
    recordedGeneration(w.provenance?.generationIdentity) +
    `<p class="muted">${escape(w.method)}. ${w.fullChunksSampled} sampled chunks have full generation status. ${w.changedRegions.length} regions changed during the read.</p><p class="muted">Snapshot ${escape(w.completedAt)} · Bounds ${escape(JSON.stringify(w.boundsBlocks))}</p>` +
    w.limitations.map((text: string) => `<p>${escape(text)}</p>`).join('') +
    (await domains()).authored.worldgen.records
      .map(
        (row: RecordData) =>
          `<article class="record content-stack"><h3>${escape(row.title)}</h3><p>${escape(row.detail)}</p></article>`,
      )
      .join('')
  drawWorld()
  drawProfile()
  travel()
}
function recordedGeneration(identity?: RecordData) {
  if (!identity) return ''
  const rows = [
    ['Algorithm', identity.algorithm],
    ['Overlap', identity.islands?.advanced?.terrain_overlap_mode],
    ['Large veins', identity.largeVeins],
    ['Interior profiles', identity.interiors],
    ['Local water', identity.water],
    ['Ocean variants', identity.oceans],
  ].filter(([, value]) => value !== undefined)
  return `<details class="disclosure"><summary>Recorded generation settings</summary><div class="content-stack"><p>Settings saved with this world. Current pack defaults may differ.</p><div class="table-scroll"><table><tbody>${rows
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escape(label)}</th><td>${typeof value === 'object' ? pretty(value) : escape(value)}</td></tr>`,
    )
    .join(
      '',
    )}</tbody></table></div><details class="disclosure"><summary>Full generation identity</summary><div class="content-stack">${pretty(identity)}</div></details></div></details>`
}
let worldGeometry = { minX: 0, minZ: 0, cell: 1, offsetX: 0, offsetY: 0 }
function drawWorld() {
  if (!world) return
  const canvas = el<HTMLCanvasElement>('world-canvas'),
    ctx = canvas.getContext('2d')!,
    regions = world.regions,
    metric = el<HTMLSelectElement>('ore-map').value
  const minX = Math.min(...regions.map((r: RecordData) => r.x)),
    maxX = Math.max(...regions.map((r: RecordData) => r.x)),
    minZ = Math.min(...regions.map((r: RecordData) => r.z)),
    maxZ = Math.max(...regions.map((r: RecordData) => r.z))
  const cell = Math.min(
    (canvas.width - 70) / (maxX - minX + 1),
    (canvas.height - 50) / (maxZ - minZ + 1),
  )
  const offsetX = (canvas.width - (maxX - minX + 1) * cell) / 2,
    offsetY = (canvas.height - (maxZ - minZ + 1) * cell) / 2
  worldGeometry = { minX, minZ, cell, offsetX, offsetY }
  const palette = readColorTokens(canvas, {
    unknown: '--map-unknown-surface',
    ink: '--ink',
    location: '--map-location-mark',
  })
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const region of regions) {
    const value =
      metric === 'land'
        ? (region.landFraction ?? 0)
        : region.samples.reduce(
            (a: number, s: RecordData) => a + (s.ores[metric] ?? 0),
            0,
          ) / Math.max(1, region.samples.length)
    const intensity =
      metric === 'land' ? Math.sqrt(value) : Math.min(1, Math.log1p(value) / 4)
    ctx.fillStyle = region.samples.length
      ? `hsl(219 ${15 + intensity * 55}% ${95 - intensity * 58}%)`
      : palette.unknown
    ctx.fillRect(
      offsetX + (region.x - minX) * cell,
      offsetY + (region.z - minZ) * cell,
      Math.max(1, cell - 0.6),
      Math.max(1, cell - 0.6),
    )
  }
  ctx.fillStyle = palette.ink
  const style = getComputedStyle(canvas)
  ctx.font = `${style.fontSize} ${style.fontFamily}`
  ctx.fillText('X → / Z ↓', offsetX, offsetY - 10)
  ctx.fillStyle = palette.location
  ctx.fillRect(offsetX - minX * cell, offsetY - minZ * cell, cell, cell)
}
function drawProfile() {
  if (!world) return
  const ore = el<HTMLSelectElement>('ore-map').value,
    profile = oreProfile(world, ore)
  el('ore-table')
    .querySelectorAll<HTMLButtonElement>('[data-ore]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.ore === ore)),
    )
  if (!profile) {
    el('ore-profile').textContent = 'No sampled ore heights for this selection.'
    return
  }
  const { rows, min, max, peak, recordedBounds } = profile
  const span = Math.max(1, max - min + 1),
    width = 368 / span
  const x = (y: number) => 34 + ((y - min) / span) * 368
  el('ore-profile').innerHTML =
    `<svg viewBox="0 0 440 170" role="img" aria-label="Estimated ore blocks by Y level from ${min} to ${max}">
    <line x1="34" y1="128" x2="402" y2="128" stroke="var(--line-subtle)"/>
    ${rows.map(([y, n]: number[]) => `<rect x="${x(y)}" y="${128 - (n / peak) * 100}" width="${Math.max(0.4, width)}" height="${(n / peak) * 100}" fill="var(--world-profile-mark)"><title>Y ${y}: ${n.toFixed(5)} estimated blocks per chunk</title></rect>`).join('')}
    ${[min, Math.round((min + max) / 2), max].map((y, i) => `<text x="${x(y)}" y="150" text-anchor="${['start', 'middle', 'end'][i]}">Y ${y}</text>`).join('')}
    </svg><p class="muted">${ore === 'land' ? 'All observed ores' : escape(ore)} · peak ${peak.toFixed(4)} estimated blocks/chunk at one Y level. ${recordedBounds ? 'Recorded dimension height.' : 'Observed height range; unsampled heights are unknown.'}</p>
    <p class="muted">World Y combines islands at different elevations. This survey does not record each block’s anchor-relative geological depth; it cannot identify a universal mining level or distinguish ordinary ore from large veins. Raw iron and copper blocks are counted separately.</p>
    <details class="disclosure"><summary>Values by Y level</summary><div class="content-stack"><div class="profile-values table-scroll"><table><thead><tr><th>World Y</th><th>Est. blocks/chunk</th></tr></thead><tbody>${rows.map(([y, n]: number[]) => `<tr><td>${y}</td><td>${n.toFixed(5)}</td></tr>`).join('')}</tbody></table></div></div></details>`
}
el('ore-map').addEventListener('change', () => {
  drawWorld()
  drawProfile()
})
el('world-canvas').addEventListener('pointermove', (event) => {
  if (!world) return
  const canvas = event.currentTarget as HTMLCanvasElement,
    rect = canvas.getBoundingClientRect(),
    g = worldGeometry
  const x =
      Math.floor(
        (((event.clientX - rect.left) * canvas.width) / rect.width -
          g.offsetX) /
          g.cell,
      ) + g.minX,
    z =
      Math.floor(
        (((event.clientY - rect.top) * canvas.height) / rect.height -
          g.offsetY) /
          g.cell,
      ) + g.minZ
  const region = world.regions.find((r: RecordData) => r.x === x && r.z === z)
  el('world-hover').textContent = region
    ? `r.${x}.${z} · block origin ${x * 512}, ${z * 512} · ${region.chunks} populated chunks · ${region.samples.length} sampled · land columns ${((region.landFraction ?? 0) * 100).toFixed(1)}%`
    : 'Outside scanned regions'
})
function travel() {
  const distance = Number(el<HTMLInputElement>('distance').value),
    speed = Number(el<HTMLInputElement>('speed').value)
  el('travel-result').textContent =
    speed > 0 && distance >= 0
      ? `${(distance / speed / 60).toFixed(1)} minutes in motion · ${(distance / speed).toFixed(0)} seconds`
      : 'Enter a nonnegative distance and positive speed.'
}
for (const id of ['distance', 'speed']) el(id).addEventListener('input', travel)
async function initEditor() {
  if (domainReady) return
  if (!import.meta.env.DEV) {
    setFeedback(
      el('editor-status'),
      'Static snapshot; edit with pnpm dev on the source machine.',
    )
    for (const id of [
      'save-editor',
      'rebuild-map',
      'export-patch',
      'refresh-data',
      'reload-editor',
    ])
      el<HTMLButtonElement>(id).disabled = true
    return
  }
  try {
    const data = await fetchJSON('/__atlas/workspace')
    editorFiles = data.files
    el('edit-domain').innerHTML = Object.keys(editorFiles)
      .map((name) => `<option>${name}</option>`)
      .join('')
    domainReady = true
    loadEditor('items')
  } catch {
    setFeedback(
      el('editor-status'),
      'Editing requires pnpm dev on this machine. Static previews are read-only.',
      'error',
    )
    el<HTMLButtonElement>('save-editor').disabled = true
    el<HTMLButtonElement>('export-patch').disabled = true
    el<HTMLButtonElement>('refresh-data').disabled = true
  }
}
function updateEditorActions() {
  const name = el<HTMLSelectElement>('edit-domain').value
  const changed =
    editorFiles[name] &&
    el<HTMLTextAreaElement>('domain-editor').value !== editorFiles[name].text
  el('reload-editor').dataset.intent = changed ? 'destructive' : 'default'
  el('rebuild-map').hidden =
    !domainReady ||
    Object.entries(editorFiles).every(
      ([name, file]) =>
        (file as RecordData).revision === meta.revisions?.[name],
    )
}
el('domain-editor').addEventListener('input', () => {
  const name = el<HTMLSelectElement>('edit-domain').value,
    text = el<HTMLTextAreaElement>('domain-editor').value,
    saved = editorFiles[name]
  if (saved) {
    if (text === saved.text) editorDrafts.delete(name)
    else
      editorDrafts.set(name, {
        text,
        revision: editorDrafts.get(name)?.revision ?? saved.revision,
      })
  }
  updateEditorActions()
})
const stopWatching = observeWorkspaceChanges({
  sources: (id) => id.startsWith('map:'),
  projections: ['map'],
  changed(change) {
    if (change.topic === 'sources' && domainReady) {
      void workspaceClient
        .query('map.sources.read', {})
        .then((data) => {
          editorFiles = data.files
          loadEditor(el<HTMLSelectElement>('edit-domain').value)
        })
        .catch((error) =>
          setFeedback(el('editor-status'), String(error), 'error'),
        )
    }
    if (change.topic === 'projections') {
      domainData = null
      world = null
      graphStale = true
      detailCache.clear()
      void loadCatalog()
        .then(async () => {
          updateEditorActions()
          if (currentView === 'graph' && graph) {
            await graph.load(true)
            graphStale = false
          }
          if (currentView === 'world') await loadWorld()
          if (currentView === 'evidence') await loadEvidence(false)
          if (selected && !el('inspector').hidden) await inspect(selected)
        })
        .catch((error) => notice(String(error), { tone: 'error' }))
    }
  },
})
if (import.meta.hot) import.meta.hot.dispose(stopWatching)
function loadEditor(name: string) {
  if (!editorFiles[name]) return
  el<HTMLSelectElement>('edit-domain').value = name
  const draft = editorDrafts.get(name)
  el<HTMLTextAreaElement>('domain-editor').value =
    draft?.text ?? editorFiles[name].text
  const conflict = draft && draft.revision !== editorFiles[name].revision
  setFeedback(
    el('editor-status'),
    conflict
      ? 'Saved source changed. Your draft is preserved; reload when ready.'
      : `data/authored/${name}.yml`,
    conflict ? 'error' : 'neutral',
  )
  updateEditorActions()
}
el('edit-domain').addEventListener('change', (event) =>
  loadEditor((event.target as HTMLSelectElement).value),
)
el('reload-editor').addEventListener('click', async () => {
  const name = el<HTMLSelectElement>('edit-domain').value
  const before = editorDrafts.get(name)
  try {
    const saved = await workspaceClient.query('map.sources.read', {})
    editorFiles = saved.files
    if (editorDrafts.get(name) === before) editorDrafts.delete(name)
    loadEditor(el<HTMLSelectElement>('edit-domain').value)
  } catch (error) {
    setFeedback(el('editor-status'), String(error), 'error')
  }
})
el('save-editor').addEventListener('click', async () => {
  const name = el<HTMLSelectElement>('edit-domain').value,
    button = el<HTMLButtonElement>('save-editor')
  button.disabled = true
  setFeedback(el('editor-status'), 'Validating and rebuilding…')
  try {
    const text = el<HTMLTextAreaElement>('domain-editor').value
    const result = await workspaceClient.command('map.source.save', {
      name,
      text,
      revision: editorDrafts.get(name)?.revision ?? editorFiles[name].revision,
    })
    editorFiles[name] = { text, revision: result.revision }
    const draft = editorDrafts.get(name)
    if (draft?.text === text) editorDrafts.delete(name)
    else if (draft)
      editorDrafts.set(name, { ...draft, revision: result.revision })
    updateEditorActions()
    try {
      const saved = await workspaceClient.query('map.sources.read', {})
      await workspaceClient.command('map.compile', { revision: saved.revision })
    } catch (error) {
      const uncertain =
        error instanceof WorkspaceClientError &&
        ['OUTCOME_UNKNOWN', 'SESSION_CHANGED'].includes(error.failure.code)
      setFeedback(
        el('editor-status'),
        `Source saved; map refresh ${uncertain ? 'unconfirmed' : 'failed'}. ${String(error)}`,
        'error',
      )
      return
    }
    domainData = null
    graphStale = true
    detailCache.clear()
    await loadCatalog()
    updateEditorActions()
    setFeedback(
      el('editor-status'),
      'Saved to disk; map rebuilt. Runtime evidence preserved.',
    )
  } catch (error) {
    setFeedback(el('editor-status'), String(error), 'error')
  } finally {
    button.disabled = false
  }
})
el('rebuild-map').addEventListener('click', async () => {
  const button = el<HTMLButtonElement>('rebuild-map')
  button.disabled = true
  setFeedback(el('editor-status'), 'Rebuilding saved sources…')
  try {
    const saved = await workspaceClient.query('map.sources.read', {})
    await workspaceClient.command('map.compile', { revision: saved.revision })
    domainData = null
    graphStale = true
    detailCache.clear()
    await loadCatalog()
    updateEditorActions()
    setFeedback(
      el('editor-status'),
      'Map rebuilt from saved sources. Unsaved edits were kept.',
    )
  } catch (error) {
    setFeedback(el('editor-status'), String(error), 'error')
  } finally {
    button.disabled = false
  }
})
el('export-patch').addEventListener('click', async () => {
  try {
    const saved = await workspaceClient.query('map.sources.read', {})
    const result = await fetchJSON('/__atlas/export', {
      revision: saved.revision,
    })
    const link = document.createElement('a')
    link.href = result.url
    link.download = 'create-skyweave-atlas-patch.zip'
    link.click()
    notice(
      'Recipe scenario exported. Test it in a disposable instance before applying to a world.',
    )
  } catch (error) {
    notice(String(error), { tone: 'error' })
  }
})
loadCatalog()
  .then(async () => {
    const params = new URLSearchParams(location.search)
    if (params.get('view') === 'world') await showView('world')
    const item = params.get('item')
    if (!item) return
    if (itemCatalog.has(item)) {
      el<HTMLInputElement>('search').value = item
      filter()
    }
    await inspect(item)
  })
  .catch((error) => {
    el('counts').textContent =
      'No generated snapshot. Run pnpm data:refresh against a configured local pack.'
    notice(String(error), { tone: 'error' })
  })

async function freshness() {
  try {
    const state = await fetchJSON('/__atlas/status')
    el('snapshot').title = state.stale
      ? 'Source files changed. Refresh implementation in Workspace.'
      : 'Runtime snapshot matches local source file fingerprint.'
    if (state.stale)
      el('snapshot').textContent = 'SOURCE CHANGED · REFRESH NEEDED'
  } catch {
    /* Static deployments have no local filesystem. */
  }
}
el('refresh-data').addEventListener('click', async () => {
  const button = el<HTMLButtonElement>('refresh-data')
  button.disabled = true
  setFeedback(
    el('editor-status'),
    'Capturing isolated runtime; this can take a minute…',
  )
  try {
    await fetchJSON('/__atlas/refresh', {})
    domainData = null
    graphStale = true
    detailCache.clear()
    await loadCatalog()
    await freshness()
    setFeedback(
      el('editor-status'),
      'Implementation refreshed. World measurements retain their separate survey date.',
    )
  } catch (error) {
    setFeedback(el('editor-status'), String(error), 'error')
  } finally {
    button.disabled = false
  }
})
if (import.meta.env.DEV) {
  setTimeout(freshness, 1500)
  // Refresh is explicit; avoid launching fingerprint processes in the background.
}
