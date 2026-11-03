import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { domains } from '../../src/lib/domains.mjs'
import type { Execution, Registration } from './service.ts'
import { canonical, hash } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { scopeKey } from './policy.ts'
import { ownedDirectory } from './paths.ts'
import { operationOwner } from './ownership.ts'

export type Source = { text: string; revision: string }
export type Sources = { files: Record<string, Source>; revision: string }
const journal =
  /^journal\/(defaults\.json|(?:chapters|locales)\/[a-z0-9_]+\.json)$/
const config = /^changes\/[a-z0-9_]+\.json$/
const additionalLocale = /^journal\/locales\/(?!en_us\.json$)[a-z0-9_]+\.json$/
const outputFolders = {
  chapter: 'overrides/common/config/questlog/chapters',
  quest: 'overrides/common/config/questlog/quests',
  locale: 'pack-fixes/assets/createsky/lang',
} as const
function generated(id: string) {
  const match = /^generated:journal:(chapter|quest|locale):([a-z0-9_/]+)$/.exec(
    id,
  )
  if (!match || match[2].split('/').some((part) => !part) || id.length > 240)
    return null
  return `${outputFolders[match[1] as keyof typeof outputFolders]}/${match[2]}.json`
}
export function journalOutputId(relative: string) {
  if (relative === 'empack.bindings.yml') return 'pack:bindings'
  for (const [kind, folder] of Object.entries(outputFolders)) {
    if (!relative.startsWith(folder + '/') || !relative.endsWith('.json'))
      continue
    const id = `generated:journal:${kind}:${relative.slice(folder.length + 1, -5)}`
    if (generated(id)) return id
  }
  throw new WorkspaceError('INVALID_INPUT', 'Unexpected journal output')
}
const fixed = {
  models: ['pack', 'authoring/model-recipes.json', true],
  'resource-pins': ['pack', 'authoring/resource-patches.json', false],
  'resource-selections': ['pack', 'authoring/resource-selections.json', false],
  'texture-resources': ['pack', 'authoring/texture-resources.json', false],
  'resource-objects': ['pack', 'authoring/resource-objects.json', false],
  reviews: ['web', 'data/authored/resource-reviews.json', true],
  'review-media': [
    'web',
    'data/research/resourcepacks/local-media.json',
    false,
  ],
  'pack:manifest': ['pack', 'empack.yml', false],
  'pack:lock': ['pack', 'empack.lock', false],
  'pack:bindings': ['pack', 'empack.bindings.yml', false],
  'client:options': ['pack', 'overrides/client/options.txt', false],
} as const

/** Stable names shared by source editing and the read-only change inventory. */
export function sourceIdentity(root: 'pack' | 'web', relative: string) {
  for (const [id, [owner, file, writable]] of Object.entries(fixed))
    if (owner === root && file === relative) return { id, writable }
  if (root === 'pack')
    for (const [kind, folder] of Object.entries(outputFolders))
      if (relative.startsWith(folder + '/') && relative.endsWith('.json'))
        return {
          id: `generated:journal:${kind}:${relative.slice(folder.length + 1, -5)}`,
          writable: false,
        }
  if (root === 'pack' && relative.startsWith('authoring/')) {
    const id = relative.slice(10)
    if (journal.test(id) || config.test(id)) return { id, writable: true }
  }
  if (root === 'web')
    for (const name of domains)
      if (relative === `data/authored/${name}.yml`)
        return { id: 'map:' + name, writable: true }
  return undefined
}

/** Allowlisted logical sources; callers never select a physical root or filename. */
export function createSourceRepository(
  registration: Registration,
  options: { journalOutputs?: boolean } = {},
) {
  const roots = Promise.all([
    fs.realpath(registration.web),
    fs.realpath(registration.pack),
  ]).then(([web, pack]) => ({ web, pack }))
  let committing = false,
    serial = 0
  function admitted(id: string) {
    const output = options.journalOutputs && generated(id)
    if (output)
      return { root: 'pack' as const, relative: output, writable: true }
    if (id.startsWith('map:') && domains.includes(id.slice(4)))
      return {
        root: 'web' as const,
        relative: `data/authored/${id.slice(4)}.yml`,
        writable: true,
      }
    if (journal.test(id) || config.test(id))
      return {
        root: 'pack' as const,
        relative: 'authoring/' + id,
        writable: true,
      }
    if (Object.hasOwn(fixed, id)) {
      const [root, relative, writable] = fixed[id as keyof typeof fixed]
      return {
        root,
        relative,
        writable:
          writable || (!!options.journalOutputs && id === 'pack:bindings'),
      }
    }
    throw new WorkspaceError('NOT_FOUND', 'Unknown source')
  }
  async function location(id: string, creating = false) {
    const entry = admitted(id)
    const root = (await roots)[entry.root]
    const file = path.join(root, entry.relative)
    if ((await fs.realpath(path.dirname(file))) !== path.dirname(file))
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Source symlinks are not supported',
      )
    try {
      if ((await fs.realpath(file)) !== file)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Source symlinks are not supported',
        )
    } catch (error) {
      if (!creating || (error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
    }
    return file
  }
  async function read(id: string): Promise<Source> {
    const bytes = await fs.readFile(await location(id))
    if (bytes.byteLength > 1_000_000)
      throw new WorkspaceError('INVALID_INPUT', 'Source exceeds 1 MB')
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      revision: hash(bytes),
    }
  }
  async function readOrMissing(id: string) {
    try {
      return await read(id)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }
  async function list(
    family: 'map' | 'authoring' | 'models' | 'reviews' | 'journal-outputs',
  ) {
    if (family === 'map') return domains.map((name) => 'map:' + name)
    if (family === 'reviews') return ['reviews']
    if (family === 'journal-outputs') {
      if (!options.journalOutputs)
        throw new WorkspaceError('NOT_FOUND', 'Unknown source family')
      const pack = (await roots).pack,
        result: string[] = []
      async function visit(relative: string) {
        const folder = path.join(pack, relative)
        try {
          if ((await fs.realpath(folder)) !== folder)
            throw new WorkspaceError(
              'INVALID_INPUT',
              'Output symlinks are not supported',
            )
          for (const entry of await fs.readdir(folder, {
            withFileTypes: true,
          })) {
            const child = relative + '/' + entry.name
            if (entry.isDirectory()) await visit(child)
            else if (entry.name.endsWith('.json'))
              result.push(journalOutputId(child))
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      for (const folder of Object.values(outputFolders)) await visit(folder)
      if (await readOrMissing('pack:bindings')) result.push('pack:bindings')
      return result.sort()
    }
    if (family === 'models')
      return [
        'models',
        'resource-pins',
        'resource-selections',
        'texture-resources',
      ]
    const base = path.join((await roots).pack, 'authoring')
    const result: string[] = []
    for (const directory of [
      'journal',
      'journal/chapters',
      'journal/locales',
      'changes',
    ]) {
      const folder = path.join(base, directory)
      if ((await fs.realpath(folder)) !== folder)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Source symlinks are not supported',
        )
      for (const entry of (await fs.readdir(folder)).sort()) {
        const id = directory + '/' + entry
        if (journal.test(id) || config.test(id)) result.push(id)
      }
    }
    return result
  }
  const revision = (files: Record<string, Source>) =>
    hash(
      canonical(
        Object.fromEntries(
          Object.entries(files).map(([id, value]) => [id, value.revision]),
        ),
      ),
    )
  async function snapshot(ids: string[]): Promise<Sources> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (committing) break
      const observed = serial
      const files = Object.fromEntries(
        await Promise.all(ids.map(async (id) => [id, await read(id)])),
      )
      if (!committing && observed === serial)
        return { files, revision: revision(files) }
    }
    throw new WorkspaceError(
      'BUSY',
      'Source files are being committed; retry shortly.',
      'after-idle',
    )
  }
  async function expect(before: Sources, family?: Parameters<typeof list>[0]) {
    const ids = family ? await list(family) : Object.keys(before.files)
    const current = await snapshot(ids)
    if (current.revision !== before.revision)
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Source changed; your draft has been kept.',
        'after-refresh',
      )
  }
  async function commitWork(
    changes: Record<string, string | null>,
    before: Sources,
    context: Pick<Execution, 'authorize' | 'committed' | 'publishInputs'> &
      Partial<Pick<Execution, 'session' | 'operationId'>>,
    family?: Parameters<typeof list>[0],
    stage = 'source',
  ) {
    if (committing)
      throw new WorkspaceError(
        'BUSY',
        'Source files are being committed.',
        'after-idle',
      )
    const entries = Object.entries(changes)
    if (!entries.length || entries.length > 100)
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Expected a bounded source batch',
      )
    const destinations = new Map<string, string>()
    for (const [id, text] of entries) {
      if (!admitted(id).writable)
        throw new WorkspaceError('INVALID_INPUT', 'This source is read-only')
      const output =
        !!options.journalOutputs && (!!generated(id) || id === 'pack:bindings')
      if (
        text === null &&
        ((!additionalLocale.test(id) && !(output && id !== 'pack:bindings')) ||
          !before.files[id])
      )
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Only additional locales can be deleted',
        )
      if (!before.files[id] && !additionalLocale.test(id) && !output)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'This source cannot be created',
        )
      if (
        text !== null &&
        (typeof text !== 'string' || Buffer.byteLength(text) > 1_000_000)
      )
        throw new WorkspaceError('INVALID_INPUT', 'Invalid source text')
      if (output && text !== null) {
        await context.authorize()
        const entry = admitted(id)
        const parent = path.dirname(entry.relative)
        if (parent !== '.')
          await ownedDirectory((await roots)[entry.root], parent)
      }
      destinations.set(id, await location(id, !before.files[id]))
    }
    await expect(before, family)
    await context.authorize()
    const transaction = randomUUID()
    const marker = await ownedDirectory(
      (await roots).web,
      path.join(
        '.cache/workspace',
        scopeKey(registration.scope),
        'transactions',
        transaction,
      ),
    )
    const written: string[] = [],
      staged: string[] = []
    let ownsCommit = false,
      retain = false
    const next = Object.fromEntries(
      entries.map(([id, text]) => [id, text === null ? null : hash(text)]),
    )
    try {
      await fs.writeFile(
        path.join(marker, 'transaction.json'),
        JSON.stringify({
          schema: 1,
          transaction,
          before: before.files,
          next,
          ...(context.session && context.operationId
            ? { owner: operationOwner(registration.scope, context) }
            : {}),
        }),
        { flag: 'wx', flush: true },
      )
      for (const [id, text] of entries)
        if (text !== null) {
          const temporary = destinations.get(id)! + `.atlas-${transaction}.tmp`
          await fs.writeFile(temporary, text, { flag: 'wx', flush: true })
          staged.push(temporary)
        }
      await expect(before, family)
      committing = ownsCommit = true
      serial++
      for (const [id, text] of entries) {
        await context.authorize()
        const current = await readOrMissing(id)
        if (
          (current?.revision ?? null) !== (before.files[id]?.revision ?? null)
        )
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Source changed during commit; review saved files.',
            'after-refresh',
          )
        const destination = await location(id, !current)
        await context.authorize()
        if (text === null) await fs.unlink(destination)
        else
          await fs.rename(
            destination + `.atlas-${transaction}.tmp`,
            destination,
          )
        written.push(id)
        await fs.writeFile(
          path.join(marker, 'progress.json.tmp'),
          JSON.stringify({ written }),
          { flush: true },
        )
        await fs.rename(
          path.join(marker, 'progress.json.tmp'),
          path.join(marker, 'progress.json'),
        )
      }
      context.committed(
        stage,
        Object.fromEntries(
          entries
            .filter(([, text]) => text !== null)
            .map(([id, text]) => [id, hash(text!)]),
        ),
      )
    } catch (error) {
      const partial: string[] = []
      for (const id of written.reverse()) {
        try {
          const current = await readOrMissing(id)
          if ((current?.revision ?? null) !== next[id]) {
            partial.push(id)
            continue
          }
          await context.authorize()
          const destination = await location(id, !current)
          const original = before.files[id]
          if (original) {
            const rollback = destination + `.atlas-${transaction}.rollback`
            await fs.writeFile(rollback, original.text, {
              flag: 'wx',
              flush: true,
            })
            try {
              if (((await readOrMissing(id))?.revision ?? null) !== next[id]) {
                partial.push(id)
                continue
              }
              await context.authorize()
              await fs.rename(rollback, destination)
            } finally {
              await fs.rm(rollback, { force: true })
            }
          } else {
            if (((await readOrMissing(id))?.revision ?? null) !== next[id]) {
              partial.push(id)
              continue
            }
            await context.authorize()
            await fs.unlink(destination)
          }
        } catch {
          partial.push(id)
        }
      }
      if (partial.length) {
        retain = true
        throw new WorkspaceError(
          'SOURCE_PARTIAL',
          'Some source changes remain saved. Review the affected sources before trying again.',
          'inspect-outcome',
          { sources: partial },
        )
      }
      throw error
    } finally {
      if (ownsCommit) {
        committing = false
        serial++
      }
      await Promise.all(staged.map((file) => fs.rm(file, { force: true })))
      // Preserve an interrupted/partial transaction's evidence for explicit recovery.
      if (!retain) await fs.rm(marker, { recursive: true, force: true })
    }
    const files = { ...before.files }
    for (const [id, text] of entries) {
      if (text === null) delete files[id]
      else files[id] = { text, revision: hash(text) }
    }
    return { files, revision: revision(files) }
  }
  const commit = (...args: Parameters<typeof commitWork>) =>
    args[2].publishInputs(() => commitWork(...args))
  return { read, snapshot, list, expect, commit, revision, location }
}
