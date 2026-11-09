import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  recoverySnapshotSchema,
  digestSchema,
  scopeSchema,
  type RecoverySnapshot,
} from '../../src/lib/workspace/contracts.ts'
import {
  defineOperation,
  type Registration,
  type Resolved,
  type Execution,
} from './service.ts'
import {
  ownerSchema,
  processPresence,
  processGroupPresence,
} from './ownership.ts'
import { createSourceRepository } from './files.ts'
import { target, scopeKey, type Grant, type Context } from './policy.ts'
import { canonical, hash } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import type { createArtifactStore } from './artifacts.ts'

type Entry = RecoverySnapshot['entries'][number]
type Candidate = {
  entry: Entry
  token: string
  grants: Grant[]
  clean?: (context: Execution) => Promise<void>
}
const stamp = (value: {
  ino: number
  size: number
  mtimeMs: number
  ctimeMs: number
}) => `${value.ino}/${value.size}/${value.mtimeMs}/${value.ctimeMs}`
const review = () =>
  new WorkspaceError(
    'REVISION_CONFLICT',
    'Recovery files changed; inspect the current recovery list.',
    'after-refresh',
  )

/** Read ownership evidence; never infer a successful operation or restore source bytes. */
export function recoveryDefinitions(
  registrations: Registration[],
  options: {
    can: (context: Context, grant: Grant) => Promise<boolean>
    session: () => string
    running: (scope: Registration['scope'], id: string) => boolean
    artifacts: ReturnType<typeof createArtifactStore>
  },
) {
  const readGrant = (ctx: Resolved): Grant => ({
    action: 'source.read',
    target: target(ctx.scope, 'source', 'recovery'),
  })
  const cleanGrant = (ctx: Resolved): Grant => ({
    action: 'generation.run',
    target: target(ctx.scope, 'projection', 'recovery'),
  })
  const lockGrant = (ctx: Resolved): Grant => ({
    action: 'generation.run',
    target: target(ctx.scope, 'projection', 'artifact-retention'),
  })
  async function allowed(ctx: Resolved, grants: Grant[]) {
    return (
      await Promise.all(grants.map((grant) => options.can(ctx, grant)))
    ).every(Boolean)
  }
  async function inspect(ctx: Resolved) {
    if (!(await allowed(ctx, [readGrant(ctx)])))
      throw new WorkspaceError('NOT_FOUND', 'Recovery is unavailable')
    const candidates: Candidate[] = [],
      web = await fs.realpath(ctx.registration.web)
    const scoped = path.join(web, '.cache/workspace', scopeKey(ctx.scope)),
      staging = path.join(web, '.cache/workspace/staging')
    let bytes = 0,
      count = 0,
      unknownProcess = false
    const jobs = new Map<
      string,
      Array<{ safe: boolean; current: () => Promise<boolean> }>
    >()
    async function names(folder: string) {
      try {
        if ((await fs.realpath(folder)) !== folder)
          throw new Error('Recovery directory is a symlink')
        const entries = await fs.readdir(folder)
        count += entries.length
        if (count > 2000)
          throw new WorkspaceError(
            'CAPACITY_REACHED',
            'Recovery inventory exceeds its limit.',
            'inspect-outcome',
          )
        return entries.sort()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
    }
    async function read(file: string, maximum = 64 * 1024) {
      const stat = await fs.lstat(file)
      if (
        !stat.isFile() ||
        (await fs.realpath(file)) !== file ||
        stat.size > maximum
      )
        throw new Error('Unrecognized recovery record')
      bytes += stat.size
      if (bytes > 32 * 1024 * 1024)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Recovery metadata exceeds its limit.',
          'inspect-outcome',
        )
      const raw = await fs.readFile(file, 'utf8'),
        after = await fs.lstat(file)
      if (stamp(stat) !== stamp(after)) throw review()
      let value: any
      try {
        value = JSON.parse(raw)
      } catch {
        value = undefined
      }
      return { value, revision: hash(raw), stamp: stamp(stat) }
    }
    async function unchanged(file: string, revision: string) {
      try {
        return (await read(file, 16 * 1024 * 1024)).revision === revision
      } catch {
        return false
      }
    }
    const id = (kind: Entry['kind'], relative: string) =>
      hash(canonical({ scope: ctx.scope, kind, relative }))
    function owner(raw: unknown) {
      const parsed = ownerSchema.safeParse(raw)
      return parsed.success ? parsed.data : undefined
    }
    function belongs(value: ReturnType<typeof owner>) {
      return !value || scopeKey(value.scope) === scopeKey(ctx.scope)
    }
    function state(value: ReturnType<typeof owner>): Entry['state'] {
      if (!value) return 'unknown'
      if (
        value.session === options.session() &&
        value.pid === process.pid &&
        options.running(ctx.scope, value.operationId)
      )
        return 'running'
      return processPresence(value.pid, value.hostname) === 'absent'
        ? 'interrupted'
        : 'unknown'
    }
    const processes = path.join(scoped, 'processes'),
      processNames = await names(processes)
    for (const name of processNames) {
      if (!z.uuid().safeParse(name.replace(/\.json$/, '')).success) continue
      const file = path.join(processes, name)
      let record: Awaited<ReturnType<typeof read>>
      try {
        record = await read(file)
      } catch (error) {
        if (error instanceof WorkspaceError) throw error
        unknownProcess = true
        candidates.push({
          entry: {
            id: id('process', name),
            kind: 'process',
            state: 'unknown',
            label: 'Unrecognized native job',
            canClean: false,
            sources: [],
          },
          token: 'unrecognized',
          grants: [],
        })
        continue
      }
      const value = record.value,
        owned = owner(value?.owner),
        recordedScope = scopeSchema.safeParse(value?.scope)
      if (!owned) unknownProcess = true
      if (
        !belongs(owned) ||
        (recordedScope.success &&
          scopeKey(recordedScope.data) !== scopeKey(ctx.scope))
      )
        continue
      const operationId =
        owned?.operationId ??
        (z.uuid().safeParse(value?.operationId).success
          ? value.operationId
          : undefined)
      const grants: Grant[] = operationId
        ? [
            {
              action: 'operation.read',
              target: target(ctx.scope, 'operation', operationId),
            },
          ]
        : []
      const related = [
        file,
        file.replace(/\.json$/, '.context.json'),
        file + '.tmp',
      ]
      const observations = await Promise.all(
        related.map(async (related) => {
          try {
            const stat = await fs.lstat(related)
            return {
              file: related,
              stamp: stamp(stat),
              safe:
                stat.isFile() &&
                stat.size <=
                  (related.endsWith('.context.json')
                    ? 1024 * 1024
                    : 64 * 1024) &&
                (await fs.realpath(related)) === related,
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
              return { file: related, stamp: null, safe: true }
            throw error
          }
        }),
      )
      const stopped = () =>
        !!owned &&
        processPresence(owned.pid, owned.hostname) === 'absent' &&
        processPresence(value?.pid, owned.hostname) === 'absent' &&
        processGroupPresence(value?.groupId, owned.hostname) === 'absent'
      const current = async () =>
        stopped() &&
        (await unchanged(file, record.revision)) &&
        (await Promise.all(
          observations.map(async (observation) => {
            try {
              const stat = await fs.lstat(observation.file)
              return (
                observation.safe &&
                stat.isFile() &&
                (await fs.realpath(observation.file)) === observation.file &&
                stamp(stat) === observation.stamp
              )
            } catch (error) {
              return (
                (error as NodeJS.ErrnoException).code === 'ENOENT' &&
                observation.stamp === null
              )
            }
          }),
        ).then((values) => values.every(Boolean)))
      const safe =
        stopped() && observations.every((observation) => observation.safe)
      if (operationId) {
        const list = jobs.get(operationId) ?? []
        list.push({ safe, current })
        jobs.set(operationId, list)
      } else unknownProcess = true
      if (!(await allowed(ctx, grants))) continue
      if (state(owned) === 'running') continue
      candidates.push({
        entry: {
          id: id('process', name),
          kind: 'process',
          state: safe ? 'interrupted' : 'unknown',
          label:
            typeof value?.name === 'string' &&
            /^[a-z][a-z0-9.]{0,79}$/.test(value.name)
              ? value.name
              : 'Interrupted native job',
          canClean: safe,
          ...(operationId ? { operationId } : {}),
          sources: [],
        },
        token: hash(
          canonical({
            record: record.revision,
            observations: observations.map((item) => item.stamp),
          }),
        ),
        grants,
        clean: safe
          ? async (context) => {
              await context.authorize()
              if (!(await current())) throw review()
              let committed = false
              for (const observation of observations)
                if (observation.stamp !== null) {
                  await context.authorize()
                  await fs.unlink(observation.file)
                  if (!committed) context.committed('recovery-cleanup')
                  committed = true
                }
            }
          : undefined,
      })
    }
    for (const name of processNames.filter(
      (name) =>
        !/^([a-f0-9-]{36}\.json|[a-f0-9-]{36}\.context\.json)$/.test(name),
    )) {
      unknownProcess = true
      candidates.push({
        entry: {
          id: id('process', name),
          kind: 'process',
          state: 'unknown',
          label: 'Unrecognized execution metadata',
          canClean: false,
          sources: [],
        },
        token: 'unrecognized',
        grants: [],
      })
    }
    for (const name of processNames.filter(
      (name) =>
        /^[a-f0-9-]{36}\.context\.json$/.test(name) &&
        !processNames.includes(name.replace('.context.json', '.json')),
    )) {
      unknownProcess = true
      candidates.push({
        entry: {
          id: id('process', name),
          kind: 'process',
          state: 'unknown',
          label: 'Unowned execution context',
          canClean: false,
          sources: [],
        },
        token: 'unowned-context',
        grants: [],
      })
    }
    const repository = createSourceRepository(ctx.registration, {
        questOutputs: true,
      }),
      transactions = path.join(scoped, 'transactions')
    for (const name of await names(transactions)) {
      if (!z.uuid().safeParse(name).success) continue
      let record: Awaited<ReturnType<typeof read>> | undefined
      try {
        record = await read(
          path.join(transactions, name, 'transaction.json'),
          16 * 1024 * 1024,
        )
      } catch (error) {
        if (error instanceof WorkspaceError) throw error
      }
      const value = record?.value,
        owned = owner(value?.owner)
      if (!belongs(owned)) continue
      const sourceIds: string[] = [],
        grants: Grant[] = []
      const sourceNames =
        value?.kind === 'generated-inputs'
          ? []
          : [
              ...new Set([
                ...Object.keys(
                  value?.before && typeof value.before === 'object'
                    ? value.before
                    : {},
                ),
                ...Object.keys(
                  value?.next && typeof value.next === 'object'
                    ? value.next
                    : {},
                ),
              ]),
            ]
      if (sourceNames.length > 512)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Source recovery record exceeds its limit.',
          'inspect-outcome',
        )
      for (const source of sourceNames) {
        try {
          await repository.location(source, true)
          sourceIds.push(source)
          grants.push({
            action: 'source.read',
            target: target(ctx.scope, 'source', source),
          })
        } catch {}
      }
      if (owned)
        grants.push({
          action: 'operation.read',
          target: target(ctx.scope, 'operation', owned.operationId),
        })
      if (!(await allowed(ctx, grants))) continue
      candidates.push({
        entry: {
          id: id(
            value?.kind === 'generated-inputs'
              ? 'generated-inputs'
              : 'source-transaction',
            name,
          ),
          kind:
            value?.kind === 'generated-inputs'
              ? 'generated-inputs'
              : 'source-transaction',
          state: 'needs-review',
          label:
            value?.kind === 'generated-inputs'
              ? 'Generated snapshot needs review'
              : 'Saved sources need review',
          canClean: false,
          sources: sourceIds,
          ...(owned ? { operationId: owned.operationId } : {}),
        },
        token: record?.revision ?? 'unrecognized',
        grants,
      })
    }
    const exclusive =
      registrations.filter(
        (registration) => registration.web === ctx.registration.web,
      ).length === 1
    for (const name of await names(staging)) {
      const folder = path.join(staging, name)
      let record: Awaited<ReturnType<typeof read>> | undefined
      try {
        record = await read(path.join(folder, 'owner.json'), 4096)
      } catch (error) {
        if (error instanceof WorkspaceError) throw error
      }
      const owned = owner(record?.value?.owner)
      if (!belongs(owned) || (!owned && !exclusive)) continue
      const grants: Grant[] = owned
        ? [
            {
              action: 'operation.read',
              target: target(ctx.scope, 'operation', owned.operationId),
            },
          ]
        : []
      if (!(await allowed(ctx, grants))) continue
      const related = owned ? (jobs.get(owned.operationId) ?? []) : []
      const safe =
        !!owned &&
        record?.value?.schema === 1 &&
        z.uuid().safeParse(name).success &&
        state(owned) === 'interrupted' &&
        !unknownProcess &&
        related.every((job) => job.safe)
      let before
      try {
        before = await fs.lstat(folder)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      if (!before.isDirectory() || before.isSymbolicLink()) continue
      if (state(owned) === 'running') continue
      candidates.push({
        entry: {
          id: id('staging', name),
          kind: 'staging',
          state: safe ? 'interrupted' : 'unknown',
          label: owned ? 'Interrupted staging files' : 'Unowned staging files',
          canClean: safe,
          sources: [],
          ...(owned ? { operationId: owned.operationId } : {}),
        },
        token: hash(
          canonical({
            owner: record?.revision ?? 'unowned',
            folder: stamp(before),
          }),
        ),
        grants,
        clean: safe
          ? async (context) => {
              await context.authorize()
              if (
                !record ||
                !owned ||
                processPresence(owned.pid, owned.hostname) !== 'absent' ||
                !(await unchanged(
                  path.join(folder, 'owner.json'),
                  record.revision,
                )) ||
                (await fs.lstat(folder)).ino !== before.ino ||
                (await fs.realpath(folder)) !== folder ||
                !(await Promise.all(related.map((job) => job.current()))).every(
                  Boolean,
                )
              )
                throw review()
              await fs.rm(folder, { recursive: true, force: true })
              context.committed('recovery-cleanup')
            }
          : undefined,
      })
    }
    const lock = await options.artifacts.recoveryLock(ctx, ctx.scope)
    if (lock) {
      const grants = lock.canClean ? [lockGrant(ctx)] : []
      const safe = lock.canClean && (await allowed(ctx, grants))
      candidates.push({
        entry: { ...lock, canClean: safe },
        token: lock.id,
        grants: safe ? grants : [],
        clean: safe
          ? (context) =>
              options.artifacts.recoverLock(context, ctx.scope, lock.id)
          : undefined,
      })
    }
    for (const candidate of candidates)
      if (
        candidate.entry.canClean &&
        !(await allowed(ctx, [cleanGrant(ctx), ...candidate.grants]))
      )
        candidate.entry.canClean = false
    candidates.sort((a, b) => a.entry.id.localeCompare(b.entry.id, 'en'))
    const selected = candidates.slice(0, 100)
    return {
      candidates: selected,
      snapshot: recoverySnapshotSchema.parse({
        entries: selected.map((candidate) => candidate.entry),
        truncated: candidates.length > 100,
        revision: hash(
          canonical(
            selected.map((candidate) => ({
              entry: candidate.entry,
              token: candidate.token,
            })),
          ),
        ),
      }),
    }
  }
  return [
    defineOperation({
      name: 'recovery.read',
      effect: 'query',
      input: z.strictObject({}),
      output: recoverySnapshotSchema,
      label: 'Read interrupted work',
      href: '/',
      success: '',
      targets: (ctx) => [readGrant(ctx)],
      resultTargets: (ctx, value) =>
        value.entries.flatMap((entry) => [
          ...entry.sources.map((source) => ({
            action: 'source.read' as const,
            target: target(ctx.scope, 'source', source),
          })),
          ...(entry.operationId
            ? [
                {
                  action: 'operation.read' as const,
                  target: target(ctx.scope, 'operation', entry.operationId),
                },
              ]
            : []),
        ]),
      execute: async (ctx) => (await inspect(ctx)).snapshot,
    }),
    defineOperation({
      name: 'recovery.cleanup',
      effect: 'generate',
      input: z.strictObject({ revision: digestSchema }),
      output: z.strictObject({ removed: z.number().int().nonnegative() }),
      label: 'Clean interrupted files',
      href: '/',
      success: 'Interrupted files cleaned.',
      targets: async (ctx) => [
        readGrant(ctx),
        cleanGrant(ctx),
        ...(await inspect(ctx)).candidates
          .filter((candidate) => candidate.entry.canClean)
          .flatMap((candidate) => candidate.grants),
      ],
      async execute(ctx, input) {
        const current = await inspect(ctx)
        if (current.snapshot.revision !== input.revision) throw review()
        let removed = 0
        const ordered = [...current.candidates].sort(
          (a, b) =>
            Number(a.entry.kind === 'process') -
            Number(b.entry.kind === 'process'),
        )
        for (const candidate of ordered)
          if (candidate.clean && candidate.entry.canClean) {
            await ctx.authorize()
            if (!(await allowed(ctx, candidate.grants)))
              throw new WorkspaceError('NOT_FOUND', 'Recovery is unavailable')
            await candidate.clean(ctx)
            removed++
          }
        ctx.invalidate('activity', [], { kind: 'recovery-changed' })
        return { removed }
      },
    }),
  ]
}
