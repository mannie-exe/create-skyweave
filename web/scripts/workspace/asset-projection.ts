import fs from 'node:fs/promises'
import path from 'node:path'
import type { Artifact } from '../../src/lib/workspace/contracts.ts'
import { WorkspaceError } from './errors.ts'
import { loadedTool } from './loaded-tool.ts'
export const assetProjectionRevision = loadedTool(import.meta.url)
// Native source provenance makes the current combined map domain about 56 MiB.
// Resource previews retain their separate, smaller per-file budget.
export const MAP_JSON_LIMIT_MIB = 64

/** Only passive images emitted by our icon compositor are admitted as SVG. */
export async function validateVisualAsset(file: string) {
  if (file.endsWith('.svg')) {
    if ((await fs.stat(file)).size > 2 * 1024 * 1024)
      throw new WorkspaceError(
        'GENERATION_FAILED',
        'Generated SVG exceeds its limit',
      )
    const text = await fs.readFile(file, 'utf8')
    if (
      !/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" image-rendering="pixelated">(?:<image width="\d+" height="\d+" href="data:image\/png;base64,[A-Za-z0-9+/=]+"\/>){1,5}<\/svg>$/.test(
        text,
      )
    )
      throw new WorkspaceError('GENERATION_FAILED', 'Unsupported generated SVG')
    return
  }
  const handle = await fs.open(file, 'r')
  try {
    const header = Buffer.alloc(8)
    await handle.read(header, 0, 8, 0)
    if (!header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      throw new WorkspaceError(
        'GENERATION_FAILED',
        'Generated texture is not a PNG',
      )
  } finally {
    await handle.close()
  }
}

/** Resolve generated links against this candidate's already-admitted files. */
export function scopedResourceLinks(
  prefix: string,
  value: unknown,
  references: Record<string, Artifact>,
): unknown {
  if (typeof value === 'string' && value.startsWith(prefix)) {
    const logical = value.slice(prefix.length).split('?')[0]
    const reference = Object.hasOwn(references, logical)
      ? references[logical]
      : undefined
    if (!reference)
      throw new WorkspaceError(
        'GENERATION_FAILED',
        'Generated resource refers to an unavailable artifact',
      )
    return reference.url
  }
  if (Array.isArray(value))
    return value.map((child) => scopedResourceLinks(prefix, child, references))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        scopedResourceLinks(prefix, child, references),
      ]),
    )
  return value
}

export async function assetProjectionFiles(
  staging: string,
  entry = 'index.json',
  profile: 'resources' | 'map' = 'resources',
) {
  const files: Record<string, string> = {}
  let total = 0
  async function visit(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile() && /\.(json|png|svg)$/.test(entry.name)) {
        const stat = await fs.stat(file)
        total += stat.size
        if (
          Object.keys(files).length >= 10000 ||
          total > (profile === 'map' ? 512 : 256) * 1024 * 1024
        )
          throw new WorkspaceError(
            'GENERATION_FAILED',
            'Resource projection exceeds its limit',
          )
        if (entry.name.endsWith('.json')) {
          if (
            stat.size >
            (profile === 'map' ? MAP_JSON_LIMIT_MIB : 16) * 1024 * 1024
          )
            throw new WorkspaceError(
              'GENERATION_FAILED',
              `Generated JSON exceeds its limit: ${path.relative(staging, file)} (${stat.size} bytes)`,
            )
          JSON.parse(await fs.readFile(file, 'utf8'))
        } else await validateVisualAsset(file)
        files[path.relative(staging, file)] = file
      } else
        throw new WorkspaceError(
          'GENERATION_FAILED',
          'Unexpected resource projection output',
        )
    }
  }
  await visit(staging)
  if (!files[entry])
    throw new WorkspaceError('GENERATION_FAILED', 'Resource index is missing')
  return files
}
