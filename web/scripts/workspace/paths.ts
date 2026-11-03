import fs from 'node:fs/promises'
import path from 'node:path'
import { WorkspaceError } from './errors.ts'

/** Create owned directories without following a symlink in any new segment. */
export async function ownedDirectory(base: string, relative: string) {
  let current = base
  for (const part of relative.split(path.sep).filter(Boolean)) {
    if (part === '.' || part === '..')
      throw new WorkspaceError('INVALID_INPUT', 'Invalid workspace directory')
    current = path.join(current, part)
    await fs.mkdir(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })
    if (
      (await fs.realpath(current)) !== current ||
      !(await fs.lstat(current)).isDirectory()
    )
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Workspace directory symlinks are not supported',
      )
  }
  return current
}
