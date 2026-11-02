import { setFeedback } from './ui'
type Kind = 'models' | 'textures'
type Editor = {
  selectFromURL: () => Promise<void>
  setActive: (value: boolean) => void
}
const loaded = new Map<Kind, Promise<Editor>>()
let active: Kind | undefined
const panels = new Map<Kind, HTMLElement>([
  ['models', document.getElementById('object-source-models')!],
  ['textures', document.getElementById('object-source-textures')!],
])
const storage = document.getElementById('object-source-storage')!
async function display(kind: Kind, id: string) {
  active = kind
  const url = new URL(location.href)
  url.searchParams.set('view', kind)
  url.searchParams.set(kind === 'models' ? 'recipe' : 'texture', id)
  history.replaceState(null, '', url)
  for (const [name, panel] of panels) {
    panel.hidden = name !== kind
    if (name === kind)
      document.getElementById('object-inline-editor')?.append(panel)
    else storage.append(panel)
  }
  try {
    if (!loaded.has(kind))
      loaded.set(
        kind,
        kind === 'models'
          ? import('./model-authoring')
          : import('./texture-authoring'),
      )
    const controller = await loaded.get(kind)!
    await controller.selectFromURL()
    for (const [name, promise] of loaded)
      (await promise).setActive(name === active)
  } catch (error) {
    setFeedback(
      document.getElementById(
        kind === 'models' ? 'models-status' : 'textures-status',
      )!,
      String(error),
      'error',
    )
  }
}
window.addEventListener('resource-object-edit', (event) => {
  const { kind, id } = (event as CustomEvent<{ kind: Kind; id: string }>).detail
  if ((kind === 'models' || kind === 'textures') && typeof id === 'string')
    void display(kind, id)
})
window.addEventListener('resource-object-edit-close', () => {
  active = undefined
  for (const panel of panels.values()) {
    panel.hidden = true
    storage.append(panel)
  }
  for (const promise of loaded)
    void promise[1].then((controller) => controller.setActive(false))
})

document.addEventListener('click', (event) => {
  if (
    !(event instanceof MouseEvent) ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  const link = (event.target as Element).closest<HTMLAnchorElement>(
    'a[data-resource-authoring-link]',
  )
  if (!link || link.target) return
  const url = new URL(link.href),
    kind = url.searchParams.get('view'),
    id = url.searchParams.get(kind === 'models' ? 'recipe' : 'texture')
  if (
    url.origin !== location.origin ||
    url.pathname !== '/resource-authoring' ||
    !id ||
    (kind !== 'models' && kind !== 'textures')
  )
    return
  event.preventDefault()
  window.dispatchEvent(
    new CustomEvent('resource-object-edit-request', { detail: { kind, id } }),
  )
})
