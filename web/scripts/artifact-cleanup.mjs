import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { scopeSchema } from '../src/lib/workspace/contracts.ts'
import { createArtifactStore } from './workspace/artifacts.ts'
import { createWorkspaceService } from './workspace/service.ts'
import { artifactMaintenanceDefinitions } from './workspace/maintenance.ts'
import { WorkspaceError } from './workspace/errors.ts'

async function scopesIn(root) {
  const scopes = new Map()
  async function directories(folder) {
    try {
      if ((await fs.realpath(folder)) !== folder)
        throw new Error('Artifact directory is a symlink')
      const entries = await fs.readdir(folder, { withFileTypes: true })
      if (
        entries.length > 1000 ||
        entries.some((entry) => !entry.isDirectory())
      )
        throw new Error('Unexpected artifact scope directory')
      return entries.map((entry) => entry.name)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }
  for (const category of ['generations', 'manifests', 'references', 'pins']) {
    for (const workspaceId of await directories(path.join(root, category))) {
      for (const packId of await directories(
        path.join(root, category, workspaceId),
      )) {
        const scope = scopeSchema.parse({ workspaceId, packId })
        const folder = path.join(root, category, workspaceId, packId)
        if ((await fs.realpath(folder)) !== folder)
          throw new Error('Artifact scope is a symlink')
        scopes.set(workspaceId + '/' + packId, scope)
        if (scopes.size > 1000) throw new Error('Too many artifact scopes')
      }
    }
  }
  return [...scopes.values()]
}

/** Offline maintenance uses the same retention implementation as the app.
 * Every discovered scope is explicitly registered only for this local invocation.
 * Another live Atlas host blocks maintenance; no process is stopped or adopted.
 */
export async function cleanArtifacts(
  web,
  { apply = false, allScopes = false, emit = () => {}, signal } = {},
) {
  web = await fs.realpath(web)
  const root = path.join(web, '.cache/workspace/artifacts')
  const primary = { workspaceId: 'local', packId: 'create_skyweave' }
  const scopes = allScopes ? await scopesIn(root) : [primary]
  if (
    !scopes.some(
      (value) =>
        value.workspaceId === primary.workspaceId &&
        value.packId === primary.packId,
    )
  )
    scopes.push(primary)
  const registrations = scopes.map((scope) => ({
    scope,
    web,
    pack: path.dirname(web),
  }))
  let service
  const store = createArtifactStore({
    root,
    registrations,
    can: (context, grant) => {
      if (signal?.aborted)
        throw new WorkspaceError(
          'CANCELLED',
          'Artifact cleanup interrupted.',
          'never',
        )
      return service.can(context, grant)
    },
  })
  service = createWorkspaceService({
    registrations,
    definitions: artifactMaintenanceDefinitions(store, {
      storeWide: allScopes,
    }),
  })
  const actor = {
    principal: { kind: 'anonymous', id: 'local-artifact-cleanup' },
    connectionId: randomUUID(),
  }
  try {
    const plan = await service.query(
      actor,
      primary,
      allScopes ? 'artifacts.store.retention' : 'artifacts.retention',
      {},
    )
    emit({ phase: 'plan', at: new Date().toISOString(), ...plan })
    if (!apply) return plan
    const command = await service.submit(actor, {
      v: 1,
      type: 'command',
      requestId: randomUUID(),
      commandId: randomUUID(),
      session: service.session,
      createdAt: new Date().toISOString(),
      scope: primary,
      operation: allScopes ? 'artifacts.store.prune' : 'artifacts.prune',
      payload: {},
    })
    const outcome = await command.outcome
    if (outcome.error)
      throw Object.assign(new Error(outcome.error.message), outcome.error)
    emit({ phase: 'result', at: new Date().toISOString(), ...outcome.payload })
    return outcome.payload
  } finally {
    await service.dispose()
    await store.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.some((arg) => !['--apply', '--all-scopes', '--watch'].includes(arg)))
    throw new Error(
      'Usage: artifact-cleanup.mjs [--apply] [--all-scopes] [--watch]',
    )
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const watch = args.includes('--watch')
  const abort = new AbortController()
  const stop = () => abort.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  do {
    try {
      await cleanArtifacts(web, {
        apply: args.includes('--apply'),
        allScopes: args.includes('--all-scopes'),
        signal: abort.signal,
        emit: (value) => process.stdout.write(JSON.stringify(value) + '\n'),
      })
    } catch (error) {
      process.stderr.write(
        JSON.stringify({
          phase: 'deferred',
          at: new Date().toISOString(),
          code: error.code,
          message: error.message,
        }) + '\n',
      )
      if (!watch) process.exitCode = 1
    }
    if (!watch || abort.signal.aborted) break
    await delay(30 * 60_000, undefined, { signal: abort.signal }).catch(
      (error) => {
        if (error.name !== 'AbortError') throw error
      },
    )
  } while (!abort.signal.aborted)
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
}
