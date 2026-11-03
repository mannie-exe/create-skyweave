import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ownedDirectory } from './paths.ts'
import { operationOwner, ownerSchema } from './ownership.ts'
import { scopeKey } from './policy.ts'
import { canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import type { Execution } from './service.ts'

/** Ownership stays beside the payload so generators cannot publish it. */
export async function operationStaging(context: Execution, purpose: string) {
  await context.authorize()
  if (!/^[a-z][a-z-]{0,39}$/.test(purpose))
    throw new Error('Invalid staging purpose')
  const owner = operationOwner(context.scope, context)
  const root = await ownedDirectory(
    await fs.realpath(context.registration.web),
    '.cache/workspace/staging',
  )
  const folder = await ownedDirectory(root, randomUUID())
  try {
    await fs.writeFile(
      path.join(folder, 'owner.json'),
      JSON.stringify({ schema: 1, purpose, owner }),
      { flag: 'wx', mode: 0o600, flush: true },
    )
    return await ownedDirectory(folder, 'data')
  } catch (error) {
    await fs.rm(folder, { recursive: true, force: true })
    throw error
  }
}
export async function disposeStaging(context: Execution, directory: string) {
  const root = path.join(
      await fs.realpath(context.registration.web),
      '.cache/workspace/staging',
    ),
    folder = path.dirname(directory)
  if (
    path.dirname(folder) !== root ||
    path.basename(directory) !== 'data' ||
    !ownerSchema.shape.operationId.safeParse(path.basename(folder)).success
  )
    throw new Error('Unknown staging directory')
  try {
    await fs.lstat(folder)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  try {
    if (
      (await fs.realpath(folder)) !== folder ||
      (await fs.realpath(path.join(folder, 'owner.json'))) !==
        path.join(folder, 'owner.json')
    )
      throw new Error('Staging symlinks are not supported')
    const info = await fs.stat(path.join(folder, 'owner.json'))
    if (info.size > 4096) throw new Error('Invalid staging owner')
    const record = JSON.parse(
      await fs.readFile(path.join(folder, 'owner.json'), 'utf8'),
    )
    const owner = ownerSchema.parse(record.owner),
      expected = operationOwner(context.scope, context)
    if (
      scopeKey(owner.scope) !== scopeKey(context.scope) ||
      canonical(owner) !== canonical(expected)
    )
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Staging ownership changed; recovery files were kept.',
        'inspect-outcome',
      )
    await fs.rm(folder, { recursive: true, force: true })
  } catch (error) {
    if (error instanceof WorkspaceError) throw error
    throw new WorkspaceError(
      'STORAGE_UNAVAILABLE',
      'Staging ownership needs review; recovery files were kept.',
      'inspect-outcome',
    )
  }
}
