import type { Preview, TextureSource } from './model-preview'

export type TextureProjection = {
  id: string
  label: string
  variant: string
  inputs: string[]
  textureOverrides?: Record<string, TextureSource>
  pack: Preview
  packLayers: { binding: string; resource: string; originalResource?: string }[]
}
type Plane = { key?: string; axis: string; surface?: string }

/** Apply built texture layers without changing the working geometry or source. */
export function applyModpackTextures(
  source: Preview,
  parts: Plane[],
  resources: TextureProjection[],
) {
  const textures = { ...source.textures }
  const bindings = { ...source.model.textures }
  let changed = false
  for (const resource of resources) {
    for (const [id, texture] of Object.entries(
      resource.textureOverrides ?? {},
    )) {
      if (!(id in source.textures)) continue
      textures[id] = texture
      changed = true
    }
    for (const [alias, id] of Object.entries(source.model.textures)) {
      const index = parts.findIndex(
        (part, index) => (part.key ?? `plane${index}`) === alias,
      )
      if (index < 0) continue
      const part = parts[index]
      const sides: Record<string, string[]> = {
        x: ['west', 'east'],
        y: ['up', 'down'],
        z: ['south', 'north'],
      }
      if (!sides[part.axis] || !['front', 'back'].includes(part.surface ?? ''))
        continue
      const direction = sides[part.axis][part.surface === 'back' ? 1 : 0]
      const layer = resource.packLayers.find(
        (layer) => layer.originalResource === id && layer.binding === direction,
      )
      if (!layer || !(id in (resource.textureOverrides ?? {}))) continue
      const texture = resource.pack.textures[layer.binding]
      if (!texture) continue
      textures[layer.resource] = texture
      bindings[alias] = layer.resource
    }
  }
  return {
    changed,
    preview: changed
      ? { ...source, textures, model: { ...source.model, textures: bindings } }
      : source,
  }
}
