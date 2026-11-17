import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { z } from 'zod'
import {
  artifactSchema,
  scopeSchema,
  type Scope,
} from '../../src/lib/workspace/contracts.ts'
import { generationSchema, type Generation } from './artifact-records.ts'
import type { Execution } from './service.ts'
import { target, scopeKey, type Context, type Grant } from './policy.ts'
import { canonical, hash } from './identity.ts'
import { processPresence } from './ownership.ts'
import { ownedDirectory } from './paths.ts'
import { WorkspaceError } from './errors.ts'

// Inventory metadata is bounded separately from the JSON parsed one record at a time.
const maximumObjects = 500_000
type IndexedGeneration = Pick<
  Generation,
  'id' | 'scope' | 'namespace' | 'publishedAt' | 'dependencies'
> & {
  file: string
  fingerprint: string
}
type Reason = 'current' | 'latest-two' | 'pin' | 'dependency' | 'foreign'
async function digest(file: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
const pinSchema = z.strictObject({
  schema: z.literal(1),
  scope: scopeSchema,
  generationId: z.uuid(),
  namespace: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  pinnedAt: z.iso.datetime(),
})
const hostSchema = z.strictObject({
  schema: z.literal(1),
  id: z.uuid(),
  pid: z.number().int().positive(),
  hostname: z.string().max(255),
})
const lockSchema = z.strictObject({
  schema: z.literal(1),
  hostId: z.uuid(),
  pid: z.number().int().positive(),
  hostname: z.string().max(255),
})
const stamp = (stat: {
  ino: number
  size: number
  mtimeMs: number
  ctimeMs: number
}) => `${stat.ino}/${stat.size}/${stat.mtimeMs}/${stat.ctimeMs}`
const busy = () =>
  new WorkspaceError(
    'BUSY',
    'Artifact maintenance is in progress; retry shortly.',
    'after-idle',
  )

/** Bounded store housekeeping. It never examines a Minecraft installation. */
export function createArtifactRetention(options: {
  root: () => Promise<string>
  can: (context: Context, grant: Grant) => Promise<boolean>
  scopes: Scope[]
  now?: () => number
}) {
  const now = options.now ?? Date.now,
    hostId = randomUUID()
  const readers = new Map<string, number>()
  let host: Promise<void> | undefined,
    closed = false,
    writers = 0,
    collecting = false
  const identity = (scope: Scope, id: string) => scopeKey(scope) + '/' + id
  function available() {
    if (closed)
      throw new WorkspaceError(
        'STORAGE_UNAVAILABLE',
        'Artifact store is stopping',
        'reconnect',
      )
    if (collecting) throw busy()
  }
  async function checked(file: string) {
    if ((await fs.realpath(file)) !== file)
      throw new Error('Artifact store contains a symlink')
    const stat = await fs.lstat(file)
    if (!stat.isFile()) throw new Error('Expected an artifact file')
    return stat
  }
  async function json(file: string, maximum = 8 * 1024 * 1024) {
    if ((await checked(file)).size > maximum)
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'An artifact metadata record exceeds its limit; inspect the store before retrying.',
        'inspect-outcome',
      )
    return JSON.parse(await fs.readFile(file, 'utf8'))
  }
  async function files(relative: string, maximum: number) {
    const root = await options.root(),
      result: Array<{
        file: string
        relative: string
        stamp: string
        size: number
        allocatedBytes: number
      }> = []
    let visited = 0
    async function visit(folder: string) {
      if (
        ++visited > maximum * 2 ||
        path.relative(path.join(root, relative), folder).split(path.sep)
          .length > 8
      )
        throw new Error('Artifact inventory exceeds its limit')
      try {
        if ((await fs.realpath(folder)) !== folder)
          throw new Error('Artifact directory is a symlink')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        if (++visited > maximum * 2)
          throw new Error('Artifact inventory exceeds its limit')
        const file = path.join(folder, entry.name)
        if (entry.isDirectory()) await visit(file)
        else {
          const stat = await checked(file)
          if (result.length >= maximum)
            throw new Error('Artifact inventory exceeds its limit')
          result.push({
            file,
            relative: path
              .relative(path.join(root, relative), file)
              .split(path.sep)
              .join('/'),
            stamp: stamp(stat),
            size: stat.size,
            allocatedBytes: stat.blocks * 512,
          })
        }
      }
    }
    await visit(path.join(root, relative))
    return result
  }
  async function ensure() {
    available()
    if (!host)
      host = (async () => {
        const root = await options.root(),
          folder = await ownedDirectory(root, 'hosts')
        await fs.writeFile(
          path.join(folder, hostId + '.json'),
          JSON.stringify({
            schema: 1,
            id: hostId,
            pid: process.pid,
            hostname: os.hostname(),
          }),
          { flag: 'wx', mode: 0o600 },
        )
      })()
    await host
    const lock = path.join(await options.root(), 'retention.lock')
    try {
      await fs.lstat(lock)
      const owner = lockSchema.parse(await json(lock, 8192))
      if (owner.hostname !== os.hostname()) throw busy()
      try {
        process.kill(owner.pid, 0)
        throw busy()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    available()
  }
  async function authorize(
    context: Context,
    scope: Scope,
    action: Grant['action'],
    kind: Grant['target']['kind'],
    id: string,
  ) {
    for (const grant of [
      {
        action: 'pack.read' as const,
        target: target(scope, 'pack', scope.packId),
      },
      { action, target: target(scope, kind, id) },
    ])
      if (!(await options.can(context, grant)))
        throw new WorkspaceError(
          'NOT_FOUND',
          'Artifact maintenance is unavailable',
        )
  }
  async function generation(
    context: Context,
    scope: Scope,
    namespace: string,
    id: string,
  ) {
    z.uuid().parse(id)
    await authorize(context, scope, 'artifact.read', 'projection', namespace)
    await ensure()
    const value = generationSchema.parse(
      await json(
        path.join(
          await options.root(),
          'generations',
          scopeKey(scope),
          id + '.json',
        ),
      ),
    )
    if (
      value.id !== id ||
      value.namespace !== namespace ||
      scopeKey(value.scope) !== scopeKey(scope)
    )
      throw new WorkspaceError('NOT_FOUND', 'Generation is unavailable')
    await authorize(context, scope, 'artifact.read', 'projection', namespace)
    return value
  }
  async function writer() {
    available()
    writers++
    try {
      await ensure()
    } catch (error) {
      writers--
      throw error
    }
    return async () => {
      writers--
      await releaseHost()
    }
  }
  async function pin(
    context: Context,
    scope: Scope,
    namespace: string,
    id: string,
    enabled: boolean,
  ) {
    await authorize(context, scope, 'review.write', 'source', 'artifact-pins')
    await authorize(context, scope, 'artifact.read', 'projection', namespace)
    const release = await writer()
    try {
      const value = await generation(context, scope, namespace, id)
      const existingPins = await files('pins/' + scopeKey(scope), 1000)
      if (
        existingPins.length >= 1000 &&
        enabled &&
        !existingPins.some((item) => item.relative === id + '.json')
      )
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Review pin limit reached',
          'after-idle',
        )
      const folder = await ownedDirectory(
          await options.root(),
          'pins/' + scopeKey(scope),
        ),
        file = path.join(folder, id + '.json')
      await authorize(context, scope, 'review.write', 'source', 'artifact-pins')
      if (enabled) {
        const temporary = file + '.' + randomUUID() + '.tmp'
        try {
          await fs.writeFile(
            temporary,
            JSON.stringify({
              schema: 1,
              scope,
              generationId: value.id,
              namespace,
              pinnedAt: new Date(now()).toISOString(),
            }),
            { flag: 'wx', mode: 0o600 },
          )
          try {
            await checked(file)
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
          await fs.rename(temporary, file)
        } finally {
          await fs.rm(temporary, { force: true })
        }
      } else {
        try {
          await checked(file)
          await fs.unlink(file)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      return { generationId: id, pinned: enabled }
    } finally {
      await release()
    }
  }
  async function hostUnused() {
    for (const item of await files('hosts', 1000)) {
      const record = hostSchema.parse(await json(item.file, 4096))
      if (item.relative !== record.id + '.json')
        throw new Error('Unexpected host marker')
      if (record.id === hostId) continue
      if (record.hostname !== os.hostname()) throw busy()
      try {
        process.kill(record.pid, 0)
        throw busy()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
  }
  async function prune(
    context: Execution,
    scope: Scope,
    dryRun = true,
    storeWide = false,
  ) {
    const selectedScopes = storeWide ? options.scopes : [scope]
    const selected = (value: Scope) =>
      selectedScopes.some((item) => scopeKey(item) === scopeKey(value))
    const permission = async () => {
      await context.authorize()
      for (const selectedScope of selectedScopes)
        await authorize(
          context,
          selectedScope,
          'generation.run',
          'projection',
          'artifact-retention',
        )
    }
    await permission()
    await ensure()
    if (writers || readers.size) throw busy()
    collecting = true
    const root = await options.root(),
      lock = path.join(root, 'retention.lock')
    const lockRecord = {
      schema: 1,
      hostId,
      pid: process.pid,
      hostname: os.hostname(),
    }
    let ownsLock = false
    try {
      await fs.writeFile(lock, JSON.stringify(lockRecord), {
        flag: 'wx',
        mode: 0o600,
      })
      ownsLock = true
      await hostUnused()
      let generations = await files('generations', 2000),
        manifests = await files('manifests', 2000),
        references = await files('references', maximumObjects),
        pins = await files('pins', 2000),
        blobs = await files('blobs', maximumObjects)
      const temporary: typeof generations = []
      let foreignTemporary = false
      const originalRoots = [...manifests, ...pins]
      const split = (items: typeof generations) =>
        items.filter((item) => {
          if (
            !/^[a-z0-9_-]+\/[a-z0-9_-]+\/[a-z0-9_.-]+\.json\.[a-f0-9-]{36}\.tmp$/.test(
              item.relative,
            )
          )
            return true
          if (
            selectedScopes.some((value) =>
              item.relative.startsWith(scopeKey(value) + '/'),
            )
          )
            temporary.push(item)
          else {
            if (storeWide)
              throw new Error(
                'Store-wide cleanup requires every temporary scope to be registered',
              )
            foreignTemporary = true
          }
          return false
        })
      generations = split(generations)
      manifests = split(manifests)
      references = split(references)
      pins = split(pins)
      const data = new Map<string, IndexedGeneration>(),
        keep = new Map<string, Set<Reason>>(),
        grouped = new Map<string, IndexedGeneration[]>(),
        currentGroups = new Set<string>()
      const retain = (key: string, reason: Reason) => {
        const reasons = keep.get(key) ?? new Set<Reason>()
        reasons.add(reason)
        keep.set(key, reasons)
      }
      const groupKey = (value: IndexedGeneration | Generation) =>
        scopeKey(value.scope) + '/' + value.namespace
      let globalSweep =
        !foreignTemporary && (storeWide || options.scopes.length === 1)
      for (const item of generations) {
        const value = generationSchema.parse(await json(item.file)),
          key = identity(value.scope, value.id)
        if (item.relative !== scopeKey(value.scope) + '/' + value.id + '.json')
          throw new Error('Generation path mismatch')
        const indexed: IndexedGeneration = {
          id: value.id,
          scope: value.scope,
          namespace: value.namespace,
          publishedAt: value.publishedAt,
          dependencies: value.dependencies,
          file: item.file,
          fingerprint: hash(canonical(value)),
        }
        data.set(key, indexed)
        if (!selected(value.scope)) {
          if (storeWide)
            throw new Error(
              'Store-wide cleanup requires every stored scope to be registered',
            )
          retain(key, 'foreign')
          globalSweep = false
        } else {
          const group = grouped.get(groupKey(value)) ?? []
          group.push(indexed)
          grouped.set(groupKey(value), group)
        }
      }
      for (const item of manifests) {
        const value = generationSchema.parse(await json(item.file)),
          key = identity(value.scope, value.id)
        if (
          item.relative !==
            scopeKey(value.scope) + '/' + value.namespace + '.json' ||
          data.get(key)?.fingerprint !== hash(canonical(value))
        )
          throw new Error('Active manifest is incomplete')
        retain(key, 'current')
        currentGroups.add(groupKey(value))
      }
      for (const [group, values] of grouped) {
        if (currentGroups.has(group)) continue
        for (const value of values
          .sort(
            (a, b) =>
              b.publishedAt.localeCompare(a.publishedAt) ||
              b.id.localeCompare(a.id),
          )
          .slice(0, 2))
          retain(identity(value.scope, value.id), 'latest-two')
      }
      for (const item of pins) {
        const pin = pinSchema.parse(await json(item.file, 8192)),
          key = identity(pin.scope, pin.generationId)
        if (
          item.relative !==
            scopeKey(pin.scope) + '/' + pin.generationId + '.json' ||
          data.get(key)?.namespace !== pin.namespace
        )
          throw new Error('Pinned input is unavailable')
        retain(key, 'pin')
      }
      const queue = [...keep.keys()]
      for (let i = 0; i < queue.length; i++) {
        const value = data.get(queue[i])
        if (!value) throw new Error('Retained generation is unavailable')
        for (const dependency of value.dependencies) {
          const key = identity(dependency.scope, dependency.generationId)
          if (!keep.has(key)) {
            retain(key, 'dependency')
            queue.push(key)
          }
        }
      }
      const retainedHashes = new Map<string, number>(),
        removeRefs: typeof references = [],
        referenced = new Map<string, string>()
      // Parse references individually; do not retain hundreds of thousands of JSON objects.
      for (const item of references) {
        const reference = artifactSchema.parse(await json(item.file, 8192)),
          key = identity(reference.scope, reference.generationId),
          foreign = !selected(reference.scope)
        if (
          item.relative !==
          scopeKey(reference.scope) + '/' + reference.id + '.json'
        )
          throw new Error('Reference path mismatch')
        if (foreign) {
          if (storeWide)
            throw new Error(
              'Store-wide cleanup requires every stored scope to be registered',
            )
          globalSweep = false
        }
        if (keep.has(key) || foreign) {
          const previous = retainedHashes.get(reference.sha256)
          if (previous !== undefined && previous !== reference.byteLength)
            throw new Error('Conflicting retained blob lengths')
          retainedHashes.set(reference.sha256, reference.byteLength)
          referenced.set(
            scopeKey(reference.scope) + '/' + reference.id,
            hash(canonical(reference)),
          )
        } else removeRefs.push(item)
      }
      for (const key of keep.keys()) {
        const value = data.get(key)!
        const record = generationSchema.parse(await json(value.file))
        if (hash(canonical(record)) !== value.fingerprint)
          throw new Error('Retained generation changed')
        for (const reference of Object.values(record.files)) {
          if (
            identity(reference.scope, reference.generationId) !== key ||
            referenced.get(scopeKey(reference.scope) + '/' + reference.id) !==
              hash(canonical(reference))
          )
            throw new Error('Retained reference is missing or inconsistent')
        }
      }
      const removeGenerations = generations.filter(
        (item) => !keep.has(item.relative.slice(0, -5)),
      )
      const removeBlobs = [],
        seenHashes = new Set<string>()
      for (const item of blobs) {
        if (
          !/^[a-f0-9]{2}\/[a-f0-9]{64}$/.test(item.relative) ||
          item.relative.slice(0, 2) !== path.basename(item.file).slice(0, 2)
        )
          throw new Error('Unexpected blob')
        const name = path.basename(item.file)
        if (retainedHashes.has(name)) {
          if (
            item.size !== retainedHashes.get(name) ||
            (await digest(item.file)) !== name
          )
            throw new Error('Retained blob is missing or corrupt')
          seenHashes.add(name)
        } else if (globalSweep) removeBlobs.push(item)
      }
      if ([...retainedHashes.keys()].some((key) => !seenHashes.has(key)))
        throw new Error('Retained blob is missing')
      const staged = await files('staging', 2000)
      for (const item of staged) {
        if (!z.uuid().safeParse(item.relative).success)
          throw new Error('Unexpected staging file')
        if (globalSweep) temporary.push(item)
      }
      const plan = {
        generations: removeGenerations,
        references: removeRefs,
        blobs: removeBlobs,
        temporary,
      }
      const result = {
        dryRun,
        policy: 'active-or-latest-two' as const,
        retained: [...keep]
          .filter(([key]) => selected(data.get(key)!.scope))
          .map(([key, reasons]) => ({
            scope: data.get(key)!.scope,
            namespace: data.get(key)!.namespace,
            generationId: data.get(key)!.id,
            reasons: [...reasons],
          })),
        generations: removeGenerations.length,
        references: removeRefs.length,
        blobs: removeBlobs.length,
        temporary: temporary.length,
        bytes: [
          ...removeGenerations,
          ...removeRefs,
          ...removeBlobs,
          ...temporary,
        ].reduce((sum, item) => sum + item.size, 0),
      }
      const stable = async () => {
        await permission()
        const currentRoots = [
          ...(await files('manifests', 2000)),
          ...(await files('pins', 2000)),
        ]
        const current = new Map(
          currentRoots.map((item) => [item.file, item.stamp]),
        )
        if (
          current.size !== originalRoots.length ||
          originalRoots.some((item) => current.get(item.file) !== item.stamp)
        )
          throw new Error('Artifact roots changed during cleanup')
      }
      await stable()
      if (!dryRun)
        for (const [kind, items] of Object.entries(plan)) {
          await stable()
          let removed = 0
          for (const item of items) {
            await permission()
            if (stamp(await checked(item.file)) !== item.stamp)
              throw new Error('Artifact changed during cleanup')
            await fs.unlink(item.file)
            if (!removed) context.committed('artifact-cleanup:' + kind)
            removed++
          }
        }
      return result
    } catch (error) {
      if (error instanceof WorkspaceError) throw error
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw busy()
      throw new WorkspaceError(
        'STORAGE_UNAVAILABLE',
        'Artifact cleanup stopped. Active content and unrecognized entries were preserved.',
        'inspect-outcome',
      )
    } finally {
      collecting = false
      if (
        ownsLock &&
        canonical(await json(lock, 8192)) === canonical(lockRecord)
      )
        await fs.unlink(lock)
    }
  }
  async function releaseHost() {
    if (closed && writers === 0 && readers.size === 0 && host) {
      await host
      await fs
        .unlink(path.join(await options.root(), 'hosts', hostId + '.json'))
        .catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        })
    }
  }
  async function recoveryLock(context: Context, scope: Scope) {
    await authorize(context, scope, 'source.read', 'source', 'recovery')
    if (options.scopes.length !== 1) return undefined
    const file = path.join(await options.root(), 'retention.lock')
    let raw: string
    try {
      if ((await checked(file)).size > 8192)
        throw new Error('Invalid maintenance lock')
      raw = await fs.readFile(file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw new WorkspaceError(
        'STORAGE_UNAVAILABLE',
        'Artifact maintenance ownership needs inspection.',
        'inspect-outcome',
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
    const owner = lockSchema.safeParse(parsed),
      presence = owner.success
        ? processPresence(owner.data.pid, owner.data.hostname)
        : 'unknown'
    return {
      id: hash(raw),
      kind: 'artifact-lock' as const,
      state:
        presence === 'absent' ? ('interrupted' as const) : ('unknown' as const),
      label: 'Artifact maintenance',
      canClean: presence === 'absent',
      sources: [],
    }
  }
  async function recoverLock(context: Execution, scope: Scope, id: string) {
    await authorize(
      context,
      scope,
      'generation.run',
      'projection',
      'artifact-retention',
    )
    const current = await recoveryLock(context, scope)
    if (!current?.canClean || current.id !== id)
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Maintenance ownership changed; the lock was kept.',
        'after-refresh',
      )
    await context.authorize()
    await authorize(
      context,
      scope,
      'generation.run',
      'projection',
      'artifact-retention',
    )
    const again = await recoveryLock(context, scope)
    if (!again?.canClean || again.id !== id)
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Maintenance ownership changed; the lock was kept.',
        'after-refresh',
      )
    await fs.unlink(path.join(await options.root(), 'retention.lock'))
    context.committed('artifact-maintenance-recovery')
  }
  return {
    ensure,
    generation,
    pin,
    prune,
    recoveryLock,
    recoverLock,
    writer,
    reader(scope: Scope, id: string) {
      available()
      const key = identity(scope, id)
      if (!readers.has(key) && readers.size >= 10_000)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Too many active artifact readers',
          'after-idle',
        )
      readers.set(key, (readers.get(key) ?? 0) + 1)
      let released = false
      return async () => {
        if (released) return
        released = true
        const count = readers.get(key)! - 1
        if (count) readers.set(key, count)
        else readers.delete(key)
        await releaseHost()
      }
    },
    async dispose() {
      closed = true
      await releaseHost()
    },
  }
}
