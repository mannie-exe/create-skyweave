import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Execution } from './service.ts'
import { createInputDigests } from './digests.ts'
import { ownedDirectory } from './paths.ts'
import { WorkspaceError } from './errors.ts'

const resourceOutput =
  'overrides/client/resourcepacks/Create Skyweave Resource Patches.zip'
export function createPackOutput() {
  const digest = createInputDigests()
  async function current(context: Pick<Execution, 'registration'>) {
    const file = path.join(
      await fs.realpath(context.registration.pack),
      resourceOutput,
    )
    try {
      return (await digest(file)).sha256
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }
  async function publish(
    context: Execution,
    candidate: string,
    expected: string | null,
    recheck: () => Promise<void>,
  ) {
    const candidateHash = (await digest(candidate)).sha256
    await recheck()
    await context.authorize()
    if ((await current(context)) !== expected)
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Resource patches changed while building',
        'after-refresh',
      )
    if (candidateHash === expected) return candidateHash
    const root = await fs.realpath(context.registration.pack)
    const directory = await ownedDirectory(root, path.dirname(resourceOutput))
    const destination = path.join(directory, path.basename(resourceOutput))
    const temporary = destination + '.' + randomUUID() + '.tmp'
    try {
      await fs.copyFile(candidate, temporary, fs.constants.COPYFILE_EXCL)
      if ((await digest(temporary)).sha256 !== candidateHash)
        throw new WorkspaceError(
          'REVISION_CONFLICT',
          'Candidate changed while publishing',
          'after-refresh',
        )
      const handle = await fs.open(temporary, 'r+')
      try {
        await handle.sync()
      } finally {
        await handle.close()
      }
      await recheck()
      await context.authorize()
      if ((await current(context)) !== expected)
        throw new WorkspaceError(
          'REVISION_CONFLICT',
          'Resource patches changed before publication',
          'after-refresh',
        )
      await fs.rename(temporary, destination)
      context.committed('resource-patches', {
        'resource-patches': candidateHash,
      })
      return candidateHash
    } finally {
      await fs.rm(temporary, { force: true })
    }
  }
  return { current, publish }
}
