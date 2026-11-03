import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { WorkspaceError } from './errors.ts'

/** Large immutable inputs are cached by exact filesystem observation identity. */
export function createInputDigests() {
  const cache = new Map<
    string,
    {
      stamp: string
      byteLength: number
      sha1: string
      sha256: string
      sha512: string
    }
  >()
  return async (file: string, maximum = 512 * 1024 * 1024) => {
    if ((await fs.realpath(file)) !== file)
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Input symlinks are not supported',
      )
    const before = await fs.stat(file, { bigint: true })
    if (!before.isFile() || before.size > BigInt(maximum))
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'Input exceeds its size limit',
      )
    const stamp = `${before.dev}:${before.ino}:${before.size}:${before.mtimeNs}:${before.ctimeNs}`
    const found = cache.get(file)
    if (found?.stamp === stamp) return found
    const sha1 = createHash('sha1'),
      sha256 = createHash('sha256'),
      sha512 = createHash('sha512')
    let bytes = 0
    for await (const chunk of createReadStream(file)) {
      bytes += chunk.length
      if (bytes > maximum)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Input exceeds its size limit',
        )
      sha256.update(chunk)
      sha1.update(chunk)
      sha512.update(chunk)
    }
    const after = await fs.stat(file, { bigint: true })
    if (
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.ctimeNs !== after.ctimeNs ||
      before.mtimeNs !== after.mtimeNs ||
      BigInt(bytes) !== before.size
    )
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Input changed while reading it',
        'after-refresh',
      )
    const result = {
      stamp,
      byteLength: bytes,
      sha1: sha1.digest('hex'),
      sha256: sha256.digest('hex'),
      sha512: sha512.digest('hex'),
    }
    cache.set(file, result)
    if (cache.size > 512) cache.delete(cache.keys().next().value!)
    return result
  }
}
