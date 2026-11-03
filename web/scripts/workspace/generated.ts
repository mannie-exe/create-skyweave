import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { ownedDirectory } from './paths.ts'
import { createInputDigests } from './digests.ts'
import type { Execution, Registration } from './service.ts'
import { scopeKey } from './policy.ts'
import { operationOwner } from './ownership.ts'

/** The existing generated-input directory remains the CLI and worker authority. */
export function createGeneratedInputs(registration: Registration) {
  const digest = createInputDigests()
  async function inventory(directory: string) {
    const files: Record<string, string> = {}
    let total = 0
    async function visit(folder: string) {
      if ((await fs.realpath(folder)) !== folder)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Generated input symlinks are not supported',
        )
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name)
        if (entry.isDirectory()) await visit(file)
        else {
          const relative = path.relative(directory, file)
          if (!entry.isFile() || !/^[a-z0-9_/-]+\.json$/.test(relative))
            throw new WorkspaceError(
              'INVALID_INPUT',
              'Unexpected generated input',
            )
          const value = await digest(file, 64 * 1024 * 1024)
          total += value.byteLength
          if (Object.keys(files).length >= 1000 || total > 256 * 1024 * 1024)
            throw new WorkspaceError(
              'CAPACITY_REACHED',
              'Generated inputs exceed their limit',
            )
          files[relative] = value.sha256
        }
      }
    }
    try {
      await visit(directory)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return files
  }
  const root = path.join(registration.web, 'data/generated')
  async function expect(directory: string, before: Record<string, string>) {
    if (canonical(await inventory(directory)) !== canonical(before))
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Generated inputs changed; the previous snapshot was kept.',
        'after-refresh',
      )
  }
  async function copy(before: Record<string, string>, destination: string) {
    await fs.mkdir(destination, { recursive: true })
    for (const [relative, revision] of Object.entries(before)) {
      const file = path.join(destination, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.copyFile(
        path.join(root, relative),
        file,
        fs.constants.COPYFILE_EXCL,
      )
      if ((await digest(file)).sha256 !== revision)
        throw new WorkspaceError(
          'REVISION_CONFLICT',
          'Generated input changed while staging.',
          'after-refresh',
        )
    }
    await expect(root, before)
  }
  async function replace<T>(
    ctx: Execution,
    candidate: string,
    before: Record<string, string>,
    publish: () => Promise<T>,
  ) {
    const next = await inventory(candidate)
    for (const relative of Object.keys(next)) {
      const text = await fs.readFile(path.join(candidate, relative), 'utf8')
      try {
        JSON.parse(text)
      } catch {
        throw new WorkspaceError(
          'GENERATION_FAILED',
          'Generated input is not valid JSON',
        )
      }
    }
    await expect(root, before)
    await ctx.authorize()
    const marker = await ownedDirectory(
      await fs.realpath(registration.web),
      path.join(
        '.cache/workspace',
        scopeKey(ctx.scope),
        'transactions',
        randomUUID(),
      ),
    )
    const backup = path.join(marker, 'generated')
    let moved = false,
      installed = false,
      published = false,
      retain = false
    async function phase(name: string) {
      await fs.writeFile(
        path.join(marker, 'transaction.tmp'),
        JSON.stringify({
          schema: 1,
          kind: 'generated-inputs',
          owner: operationOwner(registration.scope, ctx),
          phase: name,
          before,
          next,
        }),
        { flush: true },
      )
      await fs.rename(
        path.join(marker, 'transaction.tmp'),
        path.join(marker, 'transaction.json'),
      )
    }
    async function absent(file: string) {
      try {
        await fs.lstat(file)
        return false
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
        throw error
      }
    }
    try {
      return await ctx.publishInputs(async () => {
        try {
          await phase('prepared')
          await expect(root, before)
          await ctx.authorize()
          if (!(await absent(root))) {
            await fs.rename(root, backup)
            moved = true
          }
          await phase('original-moved')
          await ctx.authorize()
          if (!(await absent(root)))
            throw new WorkspaceError(
              'REVISION_CONFLICT',
              'Generated directory changed during publication.',
              'after-refresh',
            )
          await fs.rename(candidate, root)
          installed = true
          await phase('candidate-installed')
          await expect(root, next)
          const result = await publish()
          published = true
          ctx.committed('snapshot-inputs', { snapshot: hash(canonical(next)) })
          await phase('published')
          if (moved) await expect(backup, before)
          return result
        } catch (error) {
          if (published) {
            retain = true
            throw new WorkspaceError(
              'SOURCE_PARTIAL',
              'Snapshot published, but previous generated inputs changed. Recovery files were kept.',
              'inspect-outcome',
            )
          }
          try {
            if (installed) {
              await expect(root, next)
              await ctx.authorize()
              await fs.rename(root, candidate)
            }
            if (moved) {
              if (!(await absent(root)))
                throw new Error('Generated destination changed')
              await fs.rename(backup, root)
            }
          } catch {
            retain = true
            ctx.committed('snapshot-inputs', {
              snapshot: hash(canonical(next)),
            })
            throw new WorkspaceError(
              'SOURCE_PARTIAL',
              'Generated inputs need recovery. Existing projections and recovery files were kept.',
              'inspect-outcome',
            )
          }
          throw error
        }
      })
    } finally {
      if (!retain) await fs.rm(marker, { recursive: true, force: true })
    }
  }
  return {
    inventory: () => inventory(root),
    copy,
    replace,
    expect: (before: Record<string, string>) => expect(root, before),
    revision: (files: Record<string, string>) => hash(canonical(files)),
  }
}
