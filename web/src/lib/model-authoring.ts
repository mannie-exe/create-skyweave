import { MaterialMaskEditor, type MaterialMask } from './material-mask'
import {
  TextureCompositionEditor,
  type TextureEdits,
} from './texture-composition'
import { createField } from './fields'
import { setFeedback } from './ui'
import { readColorTokens } from './style-tokens'
import { requestJSON } from './http'
import { ModelPreview, type Preview, type TextureSource } from './model-preview'
import { applyModpackTextures } from './model-resource-textures'
import { loadResourceCatalogue, type TextureResource } from './resource-preview'
import { workspaceClient } from './workspace/client'
import { observeWorkspaceChanges } from './workspace/changes'
import { readJSONArtifact } from './workspace/artifacts'

type Binding = { source: string; id: string }
type Plane = {
  axis: string
  center: number
  uv: number[]
  span: number[]
  texture?: Binding
  key?: string
  surface?: string
  mask?: MaterialMask | { kind: 'alpha' }
}
type Edit = {
  element: number
  name: string
  from?: number[]
  to?: number[]
  faces: Record<string, { uv?: number[]; rotation?: number }>
}
type Recipe = {
  id: string
  label: string
  enabled: boolean
  output: string
  texture: Binding
  texture_edits?: TextureEdits
} & (
  | { kind: 'extrusion'; depth: number; threshold: number; parts: Plane[] }
  | { kind: 'fitting'; model: Binding; edits: Edit[] }
)
type Document = { schema: number; recipes: Recipe[] }
type Workspace = { document: Document; revision: string; previews: Preview[] }

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const input = (id: string) => element<HTMLInputElement>(id)
const select = (id: string) => element<HTMLSelectElement>(id)
const button = (id: string) => element<HTMLButtonElement>(id)
const status = element('models-status')
let workspace: Workspace,
  selected = new URLSearchParams(location.search).get('recipe') ?? '',
  dirty = false,
  running = false,
  version = 0
let draftVersion = 0
let resourceTextures: TextureResource[] = []
let previewMemo:
  | {
      base: Preview
      version: number
      applied: boolean
      changed: boolean
      value: Preview
    }
  | undefined
let timer: ReturnType<typeof setTimeout>, view: ModelPreview | undefined
const jsonDrafts = new Map<string, string>()
let textureSource: TextureSource | undefined,
  textureImage: HTMLImageElement | undefined
const textureCanvas = element<HTMLCanvasElement>('model-texture')
let materialEditor: MaterialMaskEditor | undefined
let compositionEditor: TextureCompositionEditor | undefined
let previewPending = false
const previewTasks = { model: 0, texture: 0 }
function previewActivity() {
  for (const kind of ['model', 'texture'] as const) {
    const surface = element(`${kind}-preview-surface`)
    const busy = previewPending || previewTasks[kind] > 0
    surface.setAttribute('aria-busy', String(busy))
    surface.querySelector<HTMLElement>('.preview-progress')!.hidden = !busy
  }
}
async function trackPreview<T>(
  kind: 'model' | 'texture',
  work: () => Promise<T>,
): Promise<T> {
  previewTasks[kind]++
  previewActivity()
  try {
    return await work()
  } finally {
    previewTasks[kind]--
    previewActivity()
  }
}
function showModel() {
  return trackPreview('model', () => view?.show(preview()) ?? Promise.resolve())
}

const request = (path: string, body?: object) =>
  requestJSON('/__atlas/models' + path, body)

function recipe() {
  return workspace.document.recipes.find((r) => r.id === selected)!
}
function preview() {
  return previewState().value
}
function previewState() {
  const base = workspace.previews.find((p) => p.id === selected)!
  const applied = input('model-modpack').checked
  if (
    previewMemo?.base === base &&
    previewMemo.version === version &&
    previewMemo.applied === applied
  )
    return previewMemo
  const r = recipe()
  const result = applyModpackTextures(
    base,
    r.kind === 'extrusion' ? r.parts : [],
    resourceTextures,
  )
  return (previewMemo = {
    base,
    version,
    applied,
    changed: result.changed,
    value: applied ? result.preview : base,
  })
}
function controls() {
  button('models-save').disabled = !dirty || running || jsonDrafts.size > 0
  button('models-generate').disabled =
    dirty || running || !workspace || jsonDrafts.size > 0
  button('models-reload').dataset.intent =
    dirty || jsonDrafts.size ? 'destructive' : 'default'
  button('models-reload').disabled = running
  for (const field of element('model-editor').querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >('input, select'))
    field.disabled = jsonDrafts.has(selected)
  button('model-reset-element').disabled = running || jsonDrafts.has(selected)
  button('model-apply-json').disabled = running
  button('model-discard-json').disabled = running || !jsonDrafts.has(selected)
  materialEditor?.refresh()
  compositionEditor?.refresh()
  const hasResources = Boolean(workspace && recipe() && previewState().changed)
  element('model-resource-preview').hidden = !hasResources
  input('model-modpack').disabled = !hasResources || jsonDrafts.has(selected)
  element('models-drafts').textContent = jsonDrafts.size
    ? `${jsonDrafts.size} unapplied JSON draft${jsonDrafts.size === 1 ? '' : 's'}`
    : ''
}
function changed() {
  dirty = true
  draftVersion++
  if (!jsonDrafts.has(selected))
    element<HTMLTextAreaElement>('model-json').value = JSON.stringify(
      recipe(),
      null,
      2,
    )
  queuePreview()
}
function queuePreview() {
  version++
  previewPending = true
  previewActivity()
  setFeedback(
    status,
    dirty ? 'Unsaved changes; updating preview…' : 'Updating preview…',
  )
  controls()
  clearTimeout(timer)
  timer = setTimeout(updatePreview, 250)
}
function options(target: HTMLSelectElement, entries: [string, string][]) {
  const previous = target.value
  target.replaceChildren(
    ...entries.map(([value, text]) => new Option(text, value)),
  )
  if (entries.some(([value]) => value === previous)) target.value = previous
}
function vector(
  id: string,
  labels: string[],
  values: number[],
  update: (v: number[]) => void,
) {
  const root = element(id)
  root.replaceChildren(
    ...labels.map((text, i) => {
      const field = document.createElement('input')
      field.id = `${id}-${i}`
      const label = createField(text, field)
      field.type = 'number'
      field.step = '0.125'
      field.value = String(values[i])
      field.addEventListener('input', () => {
        if (!field.checkValidity() || !Number.isFinite(field.valueAsNumber))
          return
        values = [...values]
        values[i] = field.valueAsNumber
        update(values)
      })
      return label
    }),
  )
}
function list() {
  const query = input('model-search').value.toLowerCase()
  element('model-list').replaceChildren(
    ...workspace.document.recipes
      .filter((r) => (r.label + ' ' + r.id).toLowerCase().includes(query))
      .map((r) => {
        const item = document.createElement('button'),
          detail = document.createElement('small')
        item.type = 'button'
        item.className = 'ui-button'
        item.dataset.intent = 'default'
        item.textContent = r.label
        detail.textContent = `${r.kind} · ${r.enabled ? 'included' : 'not included'}`
        item.append(detail)
        item.setAttribute('aria-current', String(selected === r.id))
        item.addEventListener('click', () => {
          selected = r.id
          const url = new URL(location.href)
          url.searchParams.delete('resource')
          url.searchParams.set('recipe', selected)
          history.replaceState(null, '', url)
          render()
        })
        return item
      }),
  )
}
function edit(): Edit {
  const r = recipe()
  if (r.kind !== 'fitting') throw new Error('Select a fitting recipe')
  const index = Number(select('model-element').value)
  let result = r.edits.find((e) => e.element === index)
  if (!result) {
    result = {
      element: index,
      name: preview().model.elements[index].name ?? '',
      faces: {},
    }
    r.edits.push(result)
  }
  result.faces ??= {}
  return result
}
function uv() {
  const r = recipe()
  if (r.kind === 'extrusion')
    return r.parts[Number(select('model-plane').value)].uv
  const index = Number(select('model-element').value),
    face = select('model-face').value
  return (
    r.edits.find((e) => e.element === index)?.faces?.[face]?.uv ??
    preview().model.elements[index].faces[face].uv
  )
}
function textureBinding() {
  const r = recipe()
  return r.kind === 'extrusion'
    ? (r.parts[Number(select('model-plane').value)].texture ?? r.texture)
    : r.texture
}
function setUV(value: number[]) {
  const r = recipe()
  if (r.kind === 'extrusion')
    r.parts[Number(select('model-plane').value)].uv = value
  else {
    const e = edit(),
      face = select('model-face').value
    e.faces[face] = { ...e.faces[face], uv: value }
  }
  changed()
  drawTexture()
}
function drawTexture() {
  if (!textureImage || !textureSource) return
  const context = textureCanvas.getContext('2d')!
  const size = textureCanvas.width
  context.clearRect(0, 0, size, size)
  context.imageSmoothingEnabled = false
  context.drawImage(
    textureImage,
    0,
    0,
    textureSource.width,
    textureSource.frameHeight,
    0,
    0,
    size,
    size,
  )
  const [u0, v0, u1, v1] = uv()
  context.strokeStyle = readColorTokens(textureCanvas, {
    selection: '--color-action',
  }).selection
  context.lineWidth = 2
  context.strokeRect(
    (u0 * size) / 16,
    (v0 * size) / 16,
    ((u1 - u0) * size) / 16,
    ((v1 - v0) * size) / 16,
  )
  materialEditor?.draw(context)
}
async function showTexture() {
  return trackPreview('texture', loadTexture)
}
async function loadTexture() {
  const r = recipe(),
    p = preview()
  const requestedPlane = select('model-plane').value
  const binding = textureBinding()
  const alias =
    r.kind === 'extrusion'
      ? (r.parts[Number(select('model-plane').value)].key ??
        `plane${select('model-plane').value}`)
      : ''
  const id = p.model.textures[alias] ?? binding.id
  const source = p.textures[id]
  const image = new Image()
  image.src = source.url
  await image.decode()
  if (
    selected !== r.id ||
    preview() !== p ||
    (r.kind === 'extrusion' && select('model-plane').value !== requestedPlane)
  )
    return
  textureSource = source
  textureImage = image
  textureCanvas.dataset.source = binding.id
  textureCanvas.dataset.modpack = String(
    input('model-modpack').checked && previewState().changed,
  )
  textureCanvas.dataset.appliedTexture = id
  textureCanvas.dataset.composed = String(Boolean(source.originalUrl))
  materialEditor?.setSource(image, source)
  drawTexture()
}
function fields() {
  const r = recipe(),
    p = preview()
  element('extrusion-fields').hidden = r.kind !== 'extrusion'
  element('fitting-fields').hidden = r.kind !== 'fitting'
  if (r.kind === 'extrusion') {
    input('model-depth').value = String(r.depth)
    input('model-threshold').value = String(r.threshold)
    options(
      select('model-plane'),
      r.parts.map((part, i) => [String(i), part.key ?? `Plane ${i + 1}`]),
    )
    const part = r.parts[Number(select('model-plane').value)]
    select('model-axis').value = part.axis
    if (document.getElementById('model-mask-kind'))
      select('model-mask-kind').value = part.mask?.kind ?? 'alpha'
    input('model-center').value = String(part.center)
    vector(
      'model-span',
      part.axis === 'y'
        ? ['Min X', 'Min Z', 'Max X', 'Max Z']
        : ['Start', 'Bottom', 'End', 'Top'],
      part.span,
      (value) => {
        part.span = value
        changed()
      },
    )
    view?.highlight(-1)
  } else {
    options(
      select('model-element'),
      p.model.elements.map((e, i) => [
        String(i),
        `${i + 1}: ${e.name ?? 'Element'}`,
      ]),
    )
    const index = Number(select('model-element').value),
      model = p.model.elements[index]
    options(
      select('model-face'),
      Object.keys(model.faces).map((name) => [name, name]),
    )
    const change = r.edits.find((e) => e.element === index),
      face = select('model-face').value
    select('model-rotation').value = String(
      change?.faces?.[face]?.rotation ?? model.faces[face].rotation ?? 0,
    )
    vector(
      'model-bounds',
      ['From X', 'From Y', 'From Z', 'To X', 'To Y', 'To Z'],
      [...(change?.from ?? model.from), ...(change?.to ?? model.to)],
      (value) => {
        const current = edit()
        current.from = value.slice(0, 3)
        current.to = value.slice(3)
        changed()
      },
    )
    view?.highlight(index)
  }
  vector('model-uv', ['U start', 'V start', 'U end', 'V end'], [...uv()], setUV)
  textureImage = undefined
  textureSource = undefined
  delete textureCanvas.dataset.source
  materialEditor?.clearSource()
  materialEditor?.refresh()
  element('texture-composition-tools').hidden =
    !recipe().texture_edits?.[textureBinding().id]?.length
  compositionEditor?.render()
  showTexture().catch(error)
}
function render() {
  start = undefined
  materialEditor?.cancel()
  list()
  if (!recipe()) {
    element('model-editor').hidden = true
    return
  }
  element('model-editor').hidden = false
  const related = element('model-related-textures')
  const ids = new Set(
    Object.values(
      workspace.previews.find((p) => p.id === selected)!.model.textures,
    ),
  )
  related.replaceChildren(
    ...resourceTextures
      .filter((r) => r.inputs.some((id) => ids.has(id)))
      .map((r) => {
        const link = document.createElement('a')
        link.href = `/resource-authoring?view=textures&texture=${encodeURIComponent(r.id)}&recipe=${encodeURIComponent(selected)}`
        link.dataset.resourceAuthoringLink = ''
        link.textContent = `View textures · ${r.label} · ${r.variant}`
        return link
      }),
  )
  related.hidden = !related.childElementCount
  input('model-label').value = recipe().label
  input('model-enabled').checked = recipe().enabled
  element('model-output').textContent = recipe().output
  element<HTMLTextAreaElement>('model-json').value =
    jsonDrafts.get(selected) ?? JSON.stringify(recipe(), null, 2)
  fields()
  showModel().catch(error)
  element('model-statistics').textContent =
    `${preview().elements} elements · ${preview().faces} faces`
  controls()
}
function error(reason: unknown) {
  setFeedback(
    status,
    reason instanceof Error ? reason.message : String(reason),
    'error',
  )
}
async function updatePreview() {
  if (running) return
  const requested = version
  running = true
  previewPending = true
  previewActivity()
  controls()
  try {
    const result = await request('/preview', { document: workspace.document })
    if (requested === version) {
      workspace.previews = result.previews
      await Promise.all([showModel(), showTexture()])
      element('model-statistics').textContent =
        `${preview().elements} elements · ${preview().faces} faces`
      setFeedback(
        status,
        dirty ? 'Unsaved changes; preview current' : 'Preview current',
      )
      list()
      materialEditor?.refresh()
      drawTexture()
    }
  } catch (reason) {
    error(reason)
  } finally {
    running = false
    if (requested === version) previewPending = false
    previewActivity()
    controls()
    if (requested !== version) void updatePreview()
  }
}
async function load() {
  if ((dirty || jsonDrafts.size) && !confirm('Discard unsaved model changes?'))
    return
  running = true
  previewPending = true
  previewActivity()
  controls()
  try {
    workspace = await request('')
    resourceTextures = await loadResourceCatalogue().catch(() => [])
    previewMemo = undefined
    if (!workspace.document.recipes.some((r) => r.id === selected))
      selected = workspace.document.recipes[0]?.id ?? ''
    dirty = false
    jsonDrafts.clear()
    render()
    setFeedback(status, 'Source loaded')
  } catch (reason) {
    error(reason)
  } finally {
    running = false
    previewPending = false
    previewActivity()
    controls()
  }
}
async function operation(action: 'save' | 'generate') {
  clearTimeout(timer)
  const requested = draftVersion
  running = true
  controls()
  try {
    const result = await request(
      '/' + action,
      action === 'save'
        ? {
            revision: workspace.revision,
            document: workspace.document,
          }
        : { revision: workspace.revision },
    )
    if (action === 'save') {
      workspace.revision = result.revision
      dirty = requested !== draftVersion
      setFeedback(
        status,
        dirty
          ? 'Recipes saved; newer edits remain unsaved'
          : 'Recipes saved; generate to update the pack',
      )
    } else setFeedback(status, result.output)
  } catch (reason) {
    error(reason)
  } finally {
    running = false
    controls()
    if (previewPending) void updatePreview()
  }
}

input('model-search').addEventListener('input', list)
input('model-label').addEventListener('input', () => {
  recipe().label = input('model-label').value
  changed()
  list()
})
input('model-enabled').addEventListener('change', () => {
  recipe().enabled = input('model-enabled').checked
  changed()
})
for (const [id, key] of [
  ['model-depth', 'depth'],
  ['model-threshold', 'threshold'],
] as const)
  input(id).addEventListener('input', () => {
    const r = recipe()
    if (r.kind === 'extrusion') {
      r[key] = input(id).valueAsNumber
      changed()
    }
  })
for (const id of ['model-plane', 'model-element', 'model-face'])
  select(id).addEventListener('change', fields)
select('model-axis').addEventListener('change', () => {
  const r = recipe()
  if (r.kind === 'extrusion') {
    r.parts[Number(select('model-plane').value)].axis =
      select('model-axis').value
    fields()
    changed()
  }
})
input('model-center').addEventListener('input', () => {
  const r = recipe()
  if (r.kind === 'extrusion') {
    r.parts[Number(select('model-plane').value)].center =
      input('model-center').valueAsNumber
    changed()
  }
})
select('model-rotation').addEventListener('change', () => {
  const current = edit(),
    face = select('model-face').value
  current.faces[face] = {
    ...current.faces[face],
    rotation: Number(select('model-rotation').value),
  }
  changed()
})
button('model-reset-element').addEventListener('click', () => {
  const r = recipe()
  if (r.kind !== 'fitting') return
  r.edits = r.edits.filter(
    (e) => e.element !== Number(select('model-element').value),
  )
  changed()
  // Re-read pristine template through the generator before repainting controls.
  clearTimeout(timer)
  void updatePreview().then(fields)
})
button('model-apply-json').addEventListener('click', async () => {
  const id = selected
  const rawDraft = jsonDrafts.get(id)
  try {
    const value = JSON.parse(element<HTMLTextAreaElement>('model-json').value)
    if (value.id !== selected) throw new Error('Keep the recipe ID unchanged')
    const candidate = structuredClone(workspace.document)
    candidate.recipes[workspace.document.recipes.indexOf(recipe())] = value
    const requested = version
    running = true
    controls()
    const result = await trackPreview('model', () =>
      trackPreview('texture', () =>
        request('/preview', { document: candidate }),
      ),
    )
    if (requested !== version || jsonDrafts.get(id) !== rawDraft)
      throw new Error(
        'Newer edits exist. Review them before applying JSON again.',
      )
    workspace.document = candidate
    workspace.previews = result.previews
    jsonDrafts.delete(id)
    dirty = true
    draftVersion++
    version++
    setFeedback(status, 'Unsaved changes; preview current')
    render()
    controls()
  } catch (reason) {
    error(reason)
  } finally {
    running = false
    controls()
  }
})
element<HTMLTextAreaElement>('model-json').addEventListener('input', () => {
  const text = element<HTMLTextAreaElement>('model-json').value
  if (text === JSON.stringify(recipe(), null, 2)) jsonDrafts.delete(selected)
  else jsonDrafts.set(selected, text)
  setFeedback(
    status,
    jsonDrafts.size
      ? 'Apply or discard JSON edits before saving or generating'
      : dirty
        ? 'Unsaved changes'
        : 'Source loaded',
  )
  controls()
})
button('model-discard-json').addEventListener('click', () => {
  jsonDrafts.delete(selected)
  render()
  setFeedback(status, dirty ? 'Unsaved changes' : 'Source loaded')
})
button('models-reload').addEventListener('click', () => void load())
button('models-save').addEventListener('click', () => void operation('save'))
button('models-generate').addEventListener(
  'click',
  () => void operation('generate'),
)
input('model-modpack').addEventListener('change', () => {
  previewMemo = undefined
  controls()
  void Promise.all([showModel(), showTexture()]).catch(error)
})
button('model-camera').addEventListener('click', () => view?.reset())
input('model-wire').addEventListener('change', () =>
  view?.wire(input('model-wire').checked),
)
let start: number[] | undefined
function point(event: PointerEvent) {
  const rect = textureCanvas.getBoundingClientRect()
  return [
    Math.max(
      0,
      Math.min(16, Math.round(((event.clientX - rect.left) / rect.width) * 16)),
    ),
    Math.max(
      0,
      Math.min(16, Math.round(((event.clientY - rect.top) / rect.height) * 16)),
    ),
  ]
}
textureCanvas.addEventListener('pointerdown', (event) => {
  if (jsonDrafts.has(selected)) return
  if (materialEditor?.down(event)) return
  start = point(event)
  textureCanvas.setPointerCapture(event.pointerId)
})
textureCanvas.addEventListener('pointermove', (event) =>
  materialEditor?.move(event),
)
textureCanvas.addEventListener('pointercancel', () => {
  start = undefined
  materialEditor?.cancel()
})
textureCanvas.addEventListener('pointerup', (event) => {
  if (materialEditor?.up(event)) return
  if (!start) return
  const end = point(event)
  if (start[0] !== end[0] && start[1] !== end[1]) {
    setUV([
      Math.min(start[0], end[0]),
      Math.min(start[1], end[1]),
      Math.max(start[0], end[0]),
      Math.max(start[1], end[1]),
    ])
    vector(
      'model-uv',
      ['U start', 'V start', 'U end', 'V end'],
      [...uv()],
      setUV,
    )
  }
  start = undefined
})
window.addEventListener('beforeunload', (event) => {
  if (dirty || jsonDrafts.size) {
    event.preventDefault()
  }
})
window.addEventListener('pagehide', () => view?.dispose(), { once: true })
compositionEditor = new TextureCompositionEditor(
  element('texture-operations'),
  {
    operations: () =>
      workspace && recipe()
        ? (recipe().texture_edits?.[textureBinding().id] ?? [])
        : [],
    replace: (operations) => {
      const r = recipe(),
        id = textureBinding().id
      r.texture_edits ??= {}
      if (operations.length) r.texture_edits[id] = operations
      else delete r.texture_edits[id]
      if (!Object.keys(r.texture_edits).length) delete r.texture_edits
    },
    changed,
    scope: () =>
      workspace && recipe() ? `${selected}:${textureBinding().id}` : '',
    locked: () => !workspace || jsonDrafts.has(selected),
  },
)
if (document.getElementById('model-mask-kind')) {
  materialEditor = new MaterialMaskEditor(textureCanvas, {
    plane: () => {
      const r = workspace && recipe()
      return r?.kind === 'extrusion'
        ? r.parts[Number(select('model-plane').value)]
        : undefined
    },
    preview: () =>
      preview()?.masks?.find(
        (mask) => mask.plane === Number(select('model-plane').value),
      ),
    changed,
    draw: drawTexture,
    locked: () => jsonDrafts.has(selected),
  })
  select('model-mask-kind').addEventListener('change', () => {
    const r = recipe()
    if (r.kind !== 'extrusion') return
    r.parts[Number(select('model-plane').value)].mask =
      select('model-mask-kind').value === 'material'
        ? {
            kind: 'material',
            palette: [],
            tolerance: 0,
            regions: [],
            include: [],
            exclude: [],
          }
        : { kind: 'alpha' }
    changed()
    materialEditor?.refresh()
    drawTexture()
  })
}
try {
  view = new ModelPreview(element<HTMLCanvasElement>('model-canvas'))
} catch (reason) {
  error(reason)
}
const ready = load()
const stopWatching = observeWorkspaceChanges({
  sources: (id) =>
    [
      'models',
      'resource-pins',
      'resource-selections',
      'texture-resources',
    ].includes(id),
  projections: ['models-preview', 'texture-resources', 'resource-build'],
  changed() {
    if (!workspace) return
    if (dirty || jsonDrafts.size || running) {
      setFeedback(
        status,
        'Saved model inputs changed. Your draft is preserved; reload when ready.',
        'error',
      )
      return
    }
    const before = workspace
    void (async () => {
      try {
        const saved = await workspaceClient.query('models.read', {})
        if (saved.preview.state !== 'current') {
          setFeedback(
            status,
            'Saved model inputs changed. Reload source to rebuild previews.',
          )
          return
        }
        const projection = await readJSONArtifact(saved.preview.artifact)
        if (dirty || jsonDrafts.size || running || workspace !== before) return
        workspace = { ...saved, ...projection }
        resourceTextures = await loadResourceCatalogue().catch(() => [])
        previewMemo = undefined
        if (
          !workspace.document.recipes.some((recipe) => recipe.id === selected)
        )
          selected = workspace.document.recipes[0]?.id ?? ''
        render()
        setFeedback(status, 'Saved source refreshed')
      } catch (reason) {
        error(reason)
      }
    })()
  },
})
if (import.meta.hot) import.meta.hot.dispose(stopWatching)
export async function selectFromURL() {
  await ready
  const params = new URLSearchParams(location.search)
  const id = params.get('recipe') ?? ''
  if (workspace?.document.recipes.some((r) => r.id === id)) selected = id
  if (workspace) render()
}

export function setActive(value: boolean) {
  view?.active(value)
}
