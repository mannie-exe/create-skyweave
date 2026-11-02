import {
  ResourcePreview,
  loadResourceCatalogue,
  type TextureResource,
} from './resource-preview'
import { requestJSON } from './http'
import { setFeedback } from './ui'

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const status = element('textures-status')
const search = element<HTMLInputElement>('texture-search')
let resources: TextureResource[] = []
let selected = new URLSearchParams(location.search).get('texture') ?? ''
let busy = false
const current = () => resources.find((resource) => resource.id === selected)!
const preview = new ResourcePreview(
  'texture-resource',
  (message, tone) => setFeedback(status, message, tone),
  (resource) => {
    const recipe = new URLSearchParams(location.search).get('recipe')
    const fromRecipe = recipe && resource.relatedModels?.includes(recipe)
    const target = fromRecipe ? recipe : resource.relatedModels?.[0]
    return target
      ? {
          href: `/resource-authoring?view=models&recipe=${encodeURIComponent(target)}`,
          label: fromRecipe ? 'Back to model recipe' : 'View model recipe',
        }
      : undefined
  },
)
function list() {
  const query = search.value.toLowerCase()
  const matches = resources.filter((resource) =>
    `${resource.label} ${resource.variant} ${resource.id} ${resource.inputs.join(' ')}`
      .toLowerCase()
      .includes(query),
  )
  element('texture-list').replaceChildren(
    ...matches.map((resource) => {
      const button = document.createElement('button'),
        detail = document.createElement('small')
      button.type = 'button'
      button.className = 'ui-button'
      button.dataset.intent = 'default'
      button.textContent = `${resource.label} · ${resource.variant}`
      button.setAttribute('aria-current', String(resource.id === selected))
      detail.textContent =
        resource.approval.status === 'approved'
          ? `Approved · ${resource.included ? 'generated' : 'preview only'}`
          : 'Needs review'
      button.append(detail)
      button.addEventListener('click', () => {
        selected = resource.id
        const url = new URL(location.href)
        url.searchParams.set('texture', selected)
        url.searchParams.delete('resource')
        url.searchParams.delete('recipe')
        history.replaceState(null, '', url)
        void render()
      })
      return button
    }),
  )
  if (!matches.length) {
    const empty = document.createElement('p')
    empty.textContent = 'No matching textures.'
    element('texture-list').append(empty)
  }
}
async function render() {
  list()
  const resource = current()
  element('texture-resource-editor').hidden = !resource
  if (resource) await preview.show(resource)
}
async function load(generate = false) {
  if (busy) return
  busy = true
  for (const id of ['reload', 'generate'])
    element<HTMLButtonElement>(`textures-${id}`).disabled = true
  setFeedback(
    status,
    generate ? 'Rebuilding texture previews…' : 'Loading texture resources…',
  )
  try {
    if (generate) await requestJSON('/__atlas/textures/generate', {})
    resources = await loadResourceCatalogue()
    if (!resources.some((resource) => resource.id === selected))
      selected = resources[0]?.id ?? ''
    await render()
    if (!resources.length) {
      list()
      setFeedback(status, 'No registered texture resources.')
    }
  } catch (error) {
    setFeedback(
      status,
      `${error instanceof Error ? error.message : String(error)} Rebuild previews to regenerate the catalogue.`,
      'error',
    )
  } finally {
    busy = false
    for (const id of ['reload', 'generate'])
      element<HTMLButtonElement>(`textures-${id}`).disabled = false
  }
}
search.addEventListener('input', list)
element('textures-reload').addEventListener('click', () => void load())
element('textures-generate').addEventListener('click', () => void load(true))
const ready = load()
export async function selectFromURL() {
  await ready
  const id = new URLSearchParams(location.search).get('texture')
  if (id && resources.some((resource) => resource.id === id)) {
    selected = id
    await render()
  }
}

export function setActive(value: boolean) {
  preview.active(value)
}
