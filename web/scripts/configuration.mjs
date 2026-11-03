import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

/** Local machine configuration is resolved only by the native host. */
export async function configuredPack(root) {
  const defaults = JSON.parse(
    await fs.readFile(path.join(root, 'data/local.example.json'), 'utf8'),
  )
  const local = await fs
    .readFile(path.join(root, 'data/local.json'), 'utf8')
    .catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return '{}'
    })
  const pack = { ...defaults, ...JSON.parse(local) }.pack
  return path.resolve(
    root,
    pack.startsWith('~/') ? path.join(os.homedir(), pack.slice(2)) : pack,
  )
}
