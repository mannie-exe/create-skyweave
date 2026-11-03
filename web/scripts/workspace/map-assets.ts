import fs from 'node:fs/promises'
import path from 'node:path'
import { createInputDigests } from './digests.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { validateVisualAsset } from './asset-projection.ts'

const digest = createInputDigests()
/** The catalogue identifies the exact immutable icon inputs, including layered icons. */
export async function mapIconFiles(data: string, icons: string) {
  const files: Record<string, string> = {},
    revisions: Record<string, string> = {}
  const catalogue = path.join(data, 'catalog.json')
  try {
    await digest(catalogue, 64 * 1024 * 1024)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { files, revision: hash(canonical(revisions)) }
    throw error
  }
  const items = JSON.parse(await fs.readFile(catalogue, 'utf8'))
  if (!Array.isArray(items))
    throw new WorkspaceError(
      'GENERATION_FAILED',
      'Invalid extracted item catalogue',
    )
  const urls = new Set<string>(
    items.flatMap((item) => (item.icon?.url ? [item.icon.url] : [])),
  )
  let total = 0
  for (const url of urls) {
    const match = /^\/generated\/icons\/([a-f0-9]{16,64})\.(png|svg)$/.exec(url)
    if (!match)
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Unsupported item icon reference',
      )
    const logical = 'icons/' + match[1] + '.' + match[2],
      file = path.join(icons, path.basename(logical))
    const actual = await digest(file, 2 * 1024 * 1024)
    total += actual.byteLength
    if (urls.size > 10000 || total > 64 * 1024 * 1024)
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'Item icons exceed their limits',
      )
    if (!actual.sha256.startsWith(match[1]))
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Item icon differs from its content name.',
        'after-refresh',
      )
    await validateVisualAsset(file)
    files[logical] = file
    revisions[logical] = actual.sha256
  }
  return { files, revision: hash(canonical(revisions)) }
}

export async function stageMapIcons(
  data: string,
  icons: string,
  output: string,
) {
  const admitted = await mapIconFiles(data, icons)
  await fs.mkdir(path.join(output, 'icons'), { recursive: true })
  for (const [logical, source] of Object.entries(admitted.files))
    await fs.copyFile(
      source,
      path.join(output, logical),
      fs.constants.COPYFILE_EXCL,
    )
}
