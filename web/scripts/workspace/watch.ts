import fs from 'node:fs/promises'
import path from 'node:path'
import { watch } from 'chokidar'
import {
  inventoryRoots,
  inventoryAccepts,
  projectionNamespaces,
  sourceReadGrant,
  type InventoryEntry,
  type Inventory,
  type createWorkspaceInventory,
} from './inventory.ts'
import { scopeKey, target } from './policy.ts'
import { WorkspaceError } from './errors.ts'
import type { Registration, createWorkspaceService, Event } from './service.ts'

type Service = ReturnType<typeof createWorkspaceService>
type Status = Pick<Inventory, 'monitoring' | 'restartRequired'>
type Head = { generationId: string; inputRevision: string }
const loadedCode = (entry: InventoryEntry) =>
  entry.kind === 'tool' &&
  /^tool:web\/(?:(?:scripts|src\/lib)\/.*\.(?:mjs|ts)|package\.json|pnpm-lock\.yaml|astro\.config\.ts)$/.test(
    entry.id,
  )

/** Watch hints trigger bounded revision reconciliation, never jobs or generators. */
export function createWorkspaceWatch(options: {
  registrations: Registration[]
  inventory: ReturnType<typeof createWorkspaceInventory>
  service: Service
  manifestPath: (registration: Registration, namespace: string) => string
}) {
  const states = new Map<string, Status>()
  const pending = new Set<Registration>()
  const previous = new Map<string, Map<string, InventoryEntry>>()
  const heads = new Map<string, Map<string, Head>>()
  const acknowledged = new Map<string, Map<string, string | null>>()
  const notices = new Map<string, number>()
  const settling = new Map<
    string,
    Map<string, { revision: string | null; since: number }>
  >()
  let stopped = false,
    failed = false,
    scanning = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    running: Promise<void> | undefined
  const status = (registration: Registration): Status =>
    states.get(scopeKey(registration.scope)) ?? {
      monitoring: 'starting',
      restartRequired: false,
    }
  function state(registration: Registration, patch: Partial<Status>) {
    const before = status(registration),
      after = { ...before, ...patch }
    states.set(scopeKey(registration.scope), after)
    if (
      before.monitoring !== after.monitoring ||
      before.restartRequired !== after.restartRequired
    )
      options.service.invalidate({
        scope: registration.scope,
        topic: 'sources',
        grants: [],
        payload: { kind: 'monitoring', ...after },
      })
  }
  async function projections(registration: Registration) {
    const result = new Map<string, Head>()
    for (const namespace of projectionNamespaces) {
      const file = options.manifestPath(registration, namespace)
      try {
        const stat = await fs.lstat(file)
        if (
          !stat.isFile() ||
          stat.size > 16 * 1024 * 1024 ||
          (await fs.realpath(file)) !== file
        )
          throw new Error('Invalid active manifest')
        const value = JSON.parse(await fs.readFile(file, 'utf8'))
        if (
          value.namespace !== namespace ||
          scopeKey(value.scope) !== scopeKey(registration.scope) ||
          !/^[a-f0-9]{64}$/.test(value.inputRevision) ||
          !/^[a-f0-9-]{36}$/.test(value.id)
        )
          throw new Error('Invalid active manifest')
        result.set(namespace, {
          generationId: value.id,
          inputRevision: value.inputRevision,
        })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return result
  }
  function remember(event: Event) {
    if (event.topic !== 'sources' && event.topic !== 'projections') return
    const key = scopeKey(event.scope),
      value = event.payload as Record<string, unknown> | undefined
    if (!value || typeof value.operationId !== 'string') return
    notices.set(key, (notices.get(key) ?? 0) + 1)
    options.service.invalidate({
      scope: event.scope,
      topic: 'environment',
      grants: event.grants,
      payload: { kind: 'invalidated' },
    })
    if (
      event.topic === 'sources' &&
      value.revisions &&
      typeof value.revisions === 'object'
    ) {
      const revisions =
        acknowledged.get(key) ?? new Map<string, string | null>()
      for (const [id, revision] of Object.entries(value.revisions))
        if (
          revision === null ||
          (typeof revision === 'string' && /^[a-f0-9]{64}$/.test(revision))
        )
          revisions.set(id, revision)
      acknowledged.set(key, revisions)
    }
    if (
      event.topic === 'projections' &&
      typeof value.namespace === 'string' &&
      typeof value.generationId === 'string' &&
      typeof value.inputRevision === 'string'
    )
      heads.get(key)?.set(value.namespace, {
        generationId: value.generationId,
        inputRevision: value.inputRevision,
      })
  }
  const off = options.service.onEvent(remember)
  async function reconcile(registration: Registration, initial = false) {
    const key = scopeKey(registration.scope),
      epoch = options.service.publicationState(registration.scope),
      observedNotice = notices.get(key)
    if (epoch.active) {
      schedule(registration)
      return
    }
    try {
      const snapshot = await options.inventory.scan(registration),
        currentHeads = await projections(registration)
      const after = options.service.publicationState(registration.scope)
      if (
        after.active ||
        after.revision !== epoch.revision ||
        notices.get(key) !== observedNotice
      ) {
        schedule(registration)
        return
      }
      const current = new Map(
          snapshot.entries.map((entry) => [entry.id, entry]),
        ),
        old = previous.get(key)
      if (old && !initial) {
        const own = acknowledged.get(key)
        const candidates =
          settling.get(key) ??
          new Map<string, { revision: string | null; since: number }>()
        settling.set(key, candidates)
        for (const id of new Set([...old.keys(), ...current.keys()])) {
          const entry = current.get(id),
            revision = entry?.revision ?? null
          if (
            old.get(id)?.revision === entry?.revision ||
            own?.get(id) === revision
          ) {
            candidates.delete(id)
            continue
          }
          // Chokidar settles each event's file, but another file can still be
          // written while this whole-inventory scan runs. Require the changed
          // revision itself to persist across scans before publishing it.
          const candidate = candidates.get(id)
          if (
            !candidate ||
            candidate.revision !== revision ||
            Date.now() - candidate.since < 200
          ) {
            if (!candidate || candidate.revision !== revision)
              candidates.set(id, { revision, since: Date.now() })
            const prior = old.get(id)
            if (prior) current.set(id, prior)
            else current.delete(id)
            schedule(registration)
            continue
          }
          candidates.delete(id)
          if (loadedCode(entry ?? old.get(id)!))
            state(registration, { restartRequired: true })
          options.service.invalidate({
            scope: registration.scope,
            topic: 'sources',
            grants: [sourceReadGrant(registration, id)],
            payload: {
              kind: 'invalidated',
              sources: [id],
              revisions: { [id]: revision },
              external: true,
            },
          })
          options.service.invalidate({
            scope: registration.scope,
            topic: 'environment',
            grants: [sourceReadGrant(registration, id)],
            payload: { kind: 'invalidated' },
          })
        }
      }
      // Consume only exact own-save revisions. An external edit following a save
      // has a different hash and must still be reported.
      acknowledged.delete(key)
      previous.set(key, current)
      const oldHeads = heads.get(key)
      if (oldHeads && !initial)
        for (const namespace of projectionNamespaces) {
          const head = currentHeads.get(namespace),
            prior = oldHeads.get(namespace)
          if (
            head?.generationId === prior?.generationId &&
            head?.inputRevision === prior?.inputRevision
          )
            continue
          options.service.invalidate({
            scope: registration.scope,
            topic: 'projections',
            grants: [
              {
                action: 'artifact.read',
                target: target(registration.scope, 'projection', namespace),
              },
            ],
            payload: {
              kind: 'published',
              namespace,
              generationId: head?.generationId ?? null,
              inputRevision: head?.inputRevision ?? null,
              external: true,
            },
          })
          options.service.invalidate({
            scope: registration.scope,
            topic: 'environment',
            grants: [
              {
                action: 'artifact.read',
                target: target(registration.scope, 'projection', namespace),
              },
            ],
            payload: { kind: 'invalidated' },
          })
        }
      heads.set(key, currentHeads)
      state(registration, { monitoring: failed ? 'degraded' : 'ready' })
    } catch {
      state(registration, { monitoring: 'degraded' })
    }
  }
  function schedule(registration: Registration) {
    if (stopped) return
    pending.add(registration)
    if (timer || scanning) return
    timer = setTimeout(() => {
      timer = undefined
      const batch = [...pending]
      pending.clear()
      scanning = true
      running = (async () => {
        for (const item of batch) if (!stopped) await reconcile(item)
      })().finally(afterScan)
    }, 200)
  }
  function afterScan() {
    scanning = false
    if (pending.size) schedule(pending.values().next().value!)
  }
  const watchRoots = options.registrations.flatMap((registration) => [
    ...inventoryRoots(registration).map((root) => root.file),
    ...new Set(
      projectionNamespaces.map((namespace) =>
        path.dirname(options.manifestPath(registration, namespace)),
      ),
    ),
  ])
  const watcher = watch(watchRoots, {
    ignoreInitial: true,
    followSymlinks: false,
    atomic: 100,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    ignored(file, stat) {
      return !options.registrations.some((registration) => {
        if (inventoryAccepts(registration, file, stat?.isDirectory() ?? false))
          return true
        if (
          projectionNamespaces.some(
            (namespace) =>
              file === options.manifestPath(registration, namespace),
          )
        )
          return true
        // Missing roots are observed through parents; do not traverse siblings.
        if (
          watchRoots.some(
            (root) => root === file || root.startsWith(file + path.sep),
          )
        )
          return true
        return false
      })
    },
  })
  // Register ready synchronously; missing it would leave command admission stuck.
  const ready = new Promise<void>((resolve) => {
    watcher.once('ready', () => {
      scanning = true
      running = (async () => {
        for (const registration of options.registrations)
          await reconcile(registration, true)
      })()
      void running.finally(() => {
        afterScan()
        resolve()
      })
    })
    watcher.once('error', () => resolve())
  })
  watcher.on('all', (_event, file) => {
    for (const registration of options.registrations)
      if (
        inventoryAccepts(registration, file, true) ||
        projectionNamespaces.some(
          (namespace) =>
            file === options.manifestPath(registration, namespace) ||
            file ===
              path.dirname(options.manifestPath(registration, namespace)),
        )
      )
        schedule(registration)
  })
  watcher.on('error', () => {
    failed = true
    for (const registration of options.registrations) {
      state(registration, { monitoring: 'degraded' })
      schedule(registration)
    }
  })
  return {
    ready,
    status,
    guard(registration: Registration) {
      const current = status(registration)
      if (current.restartRequired)
        throw new WorkspaceError(
          'CAPABILITY_UNAVAILABLE',
          'Authoring code changed. Restart the Atlas server before editing or generating.',
          'reconnect',
        )
      if (current.monitoring === 'starting')
        throw new WorkspaceError(
          'BUSY',
          'Source monitoring is starting; retry shortly.',
          'after-idle',
        )
    },
    async reconcile(registration: Registration) {
      await ready
      await reconcile(registration)
    },
    async dispose() {
      stopped = true
      off()
      clearTimeout(timer)
      await watcher.close()
      await running
    },
  }
}
