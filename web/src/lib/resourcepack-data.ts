import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import packSource from '../../../empack.yml?raw'
import defaultOptions from '../../../overrides/client/options.txt?raw'
import localProjects from '../../data/research/resourcepacks/local-projects.json'
import objectProjects from '../../data/research/resourcepacks/object-projects.json'
import selectedFeatures from '../../../authoring/resource-selections.json'
import { resourceStack, selectionStatus } from './resourcepack-stack.mjs'
import YAML from 'yaml'
import reviewSource from '../../data/authored/resourcepacks.yml?raw'
import packLock from '../../../empack.lock?raw'
import observations from '../../data/research/resourcepacks/projects.json'
import catalog from '../../data/research/resourcepacks/catalog.json'
import localMedia from '../../data/research/resourcepacks/local-media.json'

export const statuses: Record<string, string> = {
  installed: 'Selected stack',
  available: 'Included, not enabled',
  unselected: 'Not in pack',
  try: 'Try first',
  compare: 'Compare',
  partial: 'Selected features',
  conditional: 'Requires work',
  defer: 'Defer',
  reject: 'Not a fit',
  replaced: 'Replaced',
}

export interface Review {
  id: string
  category: string
  status: string
  description: string
  fit: string
  concern: string
  nextCheck: string
}

export interface GalleryImage {
  thumbnail: string
  url: string
  caption: string
  source: string
  captured?: string
  kind?: 'image' | 'video'
  origin?: 'author' | 'local'
  credit?: string
  presentation?: boolean
  originals?: { label: string; url: string }[]
}

interface LocalCapture {
  projects: string[]
  file: string
  kind: string
  run: string
  stage: string
  caption: string
  gallery?: boolean
  originals?: { label: string; file: string }[]
}

export interface Project {
  title: string
  url: string
  links: { label: string; url: string }[]
  gallery: GalleryImage[]
  retrieved: string
  fileNote?: string
  versionUrl?: string
  inspection: null | {
    sha512: string
    format: number
    declaresTargetFormat: boolean
    metadataWarning?: string | null
    fusionMinimum?: string | null
    fusionOverridesIncluded: boolean
    effectiveAssetCount: number
    matchingInstalledAssets: number
    matchingModNamespaces: string[]
    features: string[]
    overlaps: Record<string, { count: number; examples: string[] }>
    version: { id: string; name: string; version_type: string }
    file: { filename: string; url: string }
  }
}

export const projects = {
  ...observations.projects,
  ...objectProjects.projects,
  ...localProjects,
} as Record<string, Project>
const localArtifacts = Object.fromEntries(
  Object.entries(localProjects).map(([id, project]) => {
    let bytes: Buffer | undefined
    try {
      bytes = readFileSync(resolve(process.cwd(), '..', project.artifact.path))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return [
      id,
      {
        ...project.artifact,
        filename: project.artifact.path.split('/').at(-1),
        present: !!bytes,
        sha256: bytes
          ? createHash('sha256').update(bytes).digest('hex')
          : undefined,
      },
    ]
  }),
)
export const pack = YAML.parse(packSource)
const { stack, selected } = resourceStack(
  pack,
  YAML.parse(packLock),
  defaultOptions,
  projects,
  localArtifacts,
)
export { stack }
export const thirdParty = Object.entries(stack).filter(
  ([id]) => !(id in localProjects),
)
export const enabledThirdParty = thirdParty.filter(
  ([, item]) => item.enabled,
).length
export const partialSources = new Set(
  selectedFeatures.selections
    .filter((selection) => selection.action === 'apply')
    .map((selection) => selection.source),
)
export const ownedArtifacts = Object.values(localArtifacts).filter(
  (artifact) => artifact.present,
).length
export const checkedSelections = thirdParty.filter(
  ([, item]) => item.enabled && item.intentMatches && item.inspectionMatches,
).length
export const builtInSelections = selected.filter(
  (id: string) =>
    !['vanilla', 'fabric', 'mod_resources'].includes(id) &&
    !id.startsWith('file/'),
)
export function galleryFor(project: string): GalleryImage[] {
  return [
    ...projects[project].gallery,
    ...(localMedia.media as LocalCapture[])
      .filter(
        (media) => media.gallery !== false && media.projects.includes(project),
      )
      .map((media) => {
        const run = localMedia.runs[media.run as keyof typeof localMedia.runs]
        const url = `/generated/resource-review/${media.file}`
        return {
          url,
          thumbnail: media.kind === 'image' ? url : '',
          source: url,
          caption: `${media.stage} · ${media.caption}`,
          captured: run.date,
          kind: media.kind as 'image' | 'video',
          origin: 'local' as const,
          presentation: !!media.originals?.length,
          originals: media.originals?.map((original) => ({
            label: original.label,
            url: `/generated/resource-review/${original.file}`,
          })),
          credit: `Create: Skyweave test · ${run.date} · ${run.context} Current pack may differ.`,
        }
      }),
  ]
}
export const target = observations.target
export const reviewedAt = observations.retrieved.slice(0, 10)
export const stale =
  createHash('sha256').update(packLock).digest('hex') !== target.lockSha256
export const reviews = (YAML.parse(reviewSource).candidates as Review[])
  .map((review) => ({ ...review, status: selectionStatus(review, stack) }))
  .sort(
    (a, b) =>
      Object.keys(statuses).indexOf(a.status) -
      Object.keys(statuses).indexOf(b.status),
  )
export { catalog }
