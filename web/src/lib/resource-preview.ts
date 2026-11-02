import {
  ModelPreview,
  type Preview,
  type Model,
  type TextureSource,
} from './model-preview'
import { requestJSON } from './http'
import type { FeedbackTone } from './ui'

export type TextureResource = {
  id: string
  label: string
  variant: string
  source: string
  sourceVersion: string
  sourceSha512: string
  inputs: string[]
  objects?: string[]
  origin?: { kind: 'vanilla' | 'mod'; id: string }
  relatedModels?: string[]
  textureOverrides?: Record<string, TextureSource>
  approval: { status: string; date: string }
  included: boolean
  hasTextureChanges: boolean
  hasModelChanges?: boolean
  original: Preview
  candidate: Preview
  pack: Preview
  geometries: Record<string, { label: string; model: Model; source: string }>
  packLayers: {
    binding: string
    resource: string
    owner: string
    originalResource?: string
  }[]
  images: { label: string; original: string; candidate: string; pack: string }[]
  analysis: unknown
  stats: unknown
}
export class ResourcePreview {
  private current?: TextureResource
  private generation = 0
  private mode: 'original' | 'pack' = 'pack'
  private viewer: ModelPreview
  private modpack: HTMLInputElement
  private element<T extends HTMLElement>(suffix: string) {
    return document.getElementById(`${this.id}-${suffix}`) as T
  }
  constructor(
    private id: string,
    private report: (message: string, tone?: FeedbackTone) => void,
    private related: (resource: TextureResource) =>
      | {
          href: string
          label: string
        }
      | undefined,
  ) {
    this.viewer = new ModelPreview(this.element<HTMLCanvasElement>('model'))
    this.modpack = this.element<HTMLInputElement>('modpack')
    this.modpack.addEventListener('change', () => void this.render())
    for (const view of ['front', 'top'] as const)
      this.element(view).addEventListener('click', () =>
        this.viewer.orient(view),
      )
    this.element('reset').addEventListener('click', () => this.viewer.reset())
    window.addEventListener('pagehide', () => this.viewer.dispose(), {
      once: true,
    })
  }
  active(value: boolean) {
    this.viewer.active(value)
  }
  async show(resource: TextureResource) {
    this.current = resource
    await this.render()
  }
  private activity(active: boolean) {
    for (const name of ['model', 'image']) {
      const surface = this.element(`${name}-surface`)
      surface.setAttribute('aria-busy', String(active))
      surface.querySelector<HTMLElement>('.preview-progress')!.hidden = !active
    }
  }
  async render() {
    const resource = this.current!
    if (!resource) {
      this.element('editor').hidden = true
      return
    }
    const related = this.related(resource)
    const link = this.element<HTMLAnchorElement>('related')
    link.hidden = !related
    if (related) {
      link.href = related.href
      link.textContent = related.label
    } else link.removeAttribute('href')
    const request = ++this.generation
    this.element('editor').hidden = false
    this.element('title').textContent =
      `${resource.label} · ${resource.variant}`
    this.element('approval').textContent =
      `${resource.approval.status === 'approved' ? 'Approved' : 'Needs review'} · ${resource.approval.date}`
    this.element('source').textContent =
      `${resource.source} ${resource.sourceVersion}`
    this.element('inputs').replaceChildren(
      ...resource.inputs.map((id) => {
        const item = document.createElement('li')
        item.textContent = id
        return item
      }),
    )
    this.element('inclusion').textContent = resource.included
      ? 'Included in the generated client resource pack.'
      : 'Artwork preview; not included in the generated resource pack.'
    const hasChanges =
      resource.hasTextureChanges || resource.hasModelChanges === true
    this.element('preview-options').hidden = !hasChanges
    this.modpack.disabled = !hasChanges
    this.mode = this.modpack.checked && hasChanges ? 'pack' : 'original'
    const geometry =
      resource.geometries[this.mode === 'pack' ? 'patches' : 'native'] ??
      resource.geometries.native
    this.element('model-note').textContent =
      `${geometry.label} · static closed pose; animations are not simulated.`
    this.element('details').textContent = JSON.stringify(
      {
        source: {
          origin: resource.origin,
          objects: resource.objects,
          version: resource.sourceVersion,
          sha512: resource.sourceSha512,
        },
        geometry: geometry.source,
        packLayers: resource.packLayers,
        analysis: resource.analysis,
        stats: resource.stats,
      },
      null,
      2,
    )
    this.activity(true)
    try {
      await Promise.all([
        this.viewer.show({
          ...resource[this.mode],
          model: geometry.model,
        }),
        this.showImage(),
      ])
      if (request === this.generation)
        this.report(
          `${this.mode === 'pack' ? 'Modpack changes' : 'Baseline'} · preview current`,
        )
    } catch (error) {
      if (request === this.generation)
        this.report(
          error instanceof Error
            ? error.message
            : 'Could not load resource preview.',
          'error',
        )
    } finally {
      if (request === this.generation) this.activity(false)
    }
  }
  private async showImage() {
    const resource = this.current!,
      grid = this.element('files')
    grid.dataset.single = String(resource.images.length === 1)
    const images: HTMLImageElement[] = []
    grid.replaceChildren(
      ...resource.images.map((entry) => {
        const figure = document.createElement('figure'),
          image = document.createElement('img'),
          caption = document.createElement('figcaption'),
          link = document.createElement('a')
        image.className = 'texture-resource-image'
        image.src = entry[this.mode]
        image.alt = `${resource.label}, ${resource.variant}: ${entry.label}, ${this.mode}`
        link.href = image.src
        link.textContent = entry.label
        caption.append(link)
        figure.append(image, caption)
        images.push(image)
        return figure
      }),
    )
    await Promise.all(images.map((image) => image.decode()))
  }
}
export async function loadResourceCatalogue(): Promise<TextureResource[]> {
  const data = await requestJSON('/generated/texture-resources/index.json')
  if (data.schema !== 1 || !Array.isArray(data.resources))
    throw new Error('Unexpected texture resource catalogue')
  return data.resources
}
