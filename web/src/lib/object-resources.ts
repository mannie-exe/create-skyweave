import type { Preview } from './model-preview'
type Contributor = {
  id: string
  label: string
  kind: string
  sha256: string
  version?: string
  file?: string
}
type Evidence = {
  path: string
  contributors: Contributor[]
  winner: string | null
  filtered: boolean
}
export type ObjectScene = {
  preview: Preview
  evidence: Evidence[]
  notes: string[]
  fingerprint: string
}
export type ObjectCase = {
  id: string
  label: string
  recipe?: string
  textureResource?: string
  changed: boolean
  sourceEnabled?: boolean
  approval?: string
  included?: boolean
  previews: Record<
    string,
    { supported: boolean; url?: string; digest?: string; reason?: string }
  >
}
export type ResourceObject = {
  id: string
  registryId: string
  kind: 'block' | 'entity'
  origin: { id: string; kind: string; source?: string }
  label: string
  cases: ObjectCase[]
  recipes: string[]
  textures: string[]
  changed: boolean
  supported: boolean
  contributors: string[]
  profiles: Record<
    string,
    {
      label: string
      layers: string[]
      note?: string
      url?: string
      version?: string
      status?: string
    }
  >
}
export type ObjectCatalogue = {
  schema: number
  defaultRecipe?: string
  defaultTexture?: string
  fingerprint: string
  objects: ResourceObject[]
  layers: {
    id: string
    label: string
    kind: string
    sha256: string
    warnings: string[]
  }[]
  unassigned: { id: string; label: string; output: string }[]
}

export function comparisonProfiles(variant: ObjectCase) {
  const seen = new Set<string>()
  return [
    'pack',
    'native',
    'selected',
    ...Object.keys(variant.previews).filter(
      (id) => !['native', 'pack', 'selected'].includes(id),
    ),
  ].filter((id) => {
    const stage = variant.previews[id]
    if (!stage?.supported) return true
    // Keep the named FA control even where it produces the same result as the stack.
    if (seen.has(stage.digest!) && id !== 'fa-base') return false
    seen.add(stage.digest!)
    return true
  })
}
