import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { artifactMaintenanceDefinitions } from '../scripts/workspace/maintenance.ts'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { hash } from '../scripts/workspace/identity.ts'
import { cleanArtifacts } from '../scripts/artifact-cleanup.mjs'

const actor = {
  principal: { kind: 'anonymous', id: 'local' },
  connectionId: randomUUID(),
}
const day = 24 * 60 * 60_000
async function fixture(t, multiple = false) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-retention-')),
  )
  const scopes = ['alpha', 'beta'].map((packId) => ({
    workspaceId: 'local',
    packId,
  }))
  const registrations = (multiple ? scopes : scopes.slice(0, 1)).map(
    (scope) => ({
      scope,
      web: root,
      pack: root,
    }),
  )
  const staging = path.join(root, 'candidate')
  await fs.mkdir(staging)
  let service,
    clock = Date.now(),
    failed = false,
    hold,
    deny = '',
    revokeWhen
  const policy = {
    mode: 'restricted',
    async decide(_actor, action, target) {
      return {
        allowed:
          !(
            target.id === 'artifact-retention' &&
            revokeWhen &&
            (await revokeWhen())
          ) &&
          !(deny === 'all' && target.id === 'artifact-retention') &&
          !(deny === 'beta' && target.packId === 'beta'),
      }
    },
  }
  const store = createArtifactStore({
    root: path.join(root, 'artifacts'),
    registrations,
    can: (ctx, grant) => service.can(ctx, grant),
    now: () => clock,
  })
  service = createWorkspaceService({
    registrations,
    policy,
    definitions: [
      ...artifactMaintenanceDefinitions(store, { storeWide: true }),
      defineOperation({
        name: 'fixture.publish',
        effect: 'generate',
        input: z.strictObject({
          namespace: z.string(),
          value: z.string(),
          dependencies: z.array(z.unknown()).default([]),
        }),
        output: z.unknown(),
        label: 'Publish',
        href: '/',
        success: 'Published',
        targets: () => [],
        async execute(ctx, input) {
          const file = path.join(staging, 'payload.txt')
          await fs.writeFile(file, input.value)
          return store.publish(ctx, {
            namespace: input.namespace,
            staging,
            files: { 'payload.txt': file },
            inputs: { value: hash(input.value) },
            dependencies: input.dependencies,
            recheck: async () => {
              if (hold) {
                hold.entered.resolve()
                await hold.promise
              }
              if (failed) throw new Error('fixture failure')
            },
          })
        },
      }),
    ],
  })
  t.after(async () => {
    await service.dispose()
    await store.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  async function run(operation, payload = {}, scope = scopes[0]) {
    const admission = await service.submit(actor, {
      v: 1,
      type: 'command',
      requestId: randomUUID(),
      commandId: randomUUID(),
      session: service.session,
      createdAt: new Date().toISOString(),
      scope,
      operation,
      payload,
    })
    const result = await admission.outcome
    if (result.error)
      throw Object.assign(new Error(result.error.message), result.error)
    return result.payload
  }
  return {
    root,
    scopes,
    registrations,
    store,
    service,
    run,
    advance(ms) {
      clock += ms
    },
    deny(value) {
      deny = value
    },
    revokeWhen(value) {
      revokeWhen = value
    },
    fail(value) {
      failed = value
    },
    hold(value) {
      hold = { ...value, entered: Promise.withResolvers() }
      return hold.entered.promise
    },
    async publish(
      value,
      namespace = 'map',
      dependencies = [],
      scope = scopes[0],
    ) {
      clock += 1000
      return run('fixture.publish', { value, namespace, dependencies }, scope)
    },
    inspect: () => service.query(actor, scopes[0], 'artifacts.retention', {}),
  }
}

test('current generation replaces historical retention even for just-published runs', async (t) => {
  const f = await fixture(t)
  const first = await f.publish('first')
  await f.publish('second')
  const current = await f.publish('current')
  // A completed read is not activity and must not start a retention timer.
  await f.store.resolve(actor, f.scopes[0], first.files['payload.txt'].id)
  assert.equal((await f.inspect()).generations, 2)
  await f.run('artifacts.prune')
  assert.equal((await f.store.active(actor, f.scopes[0], 'map')).id, current.id)
})

test('without a current generation, keep exactly the latest two per namespace', async (t) => {
  const f = await fixture(t)
  const versions = []
  for (let i = 0; i < 4; i++) versions.push(await f.publish('version ' + i))
  await fs.unlink(path.join(f.root, 'artifacts/manifests/local/alpha/map.json'))
  await f.publish('other category', 'objects')
  assert.equal((await f.inspect()).generations, 2)
  await f.run('artifacts.prune')
  for (const i of [2, 3])
    assert(
      await f.store.resolve(
        actor,
        f.scopes[0],
        versions[i].files['payload.txt'].id,
      ),
    )
  await assert.rejects(
    f.store.resolve(actor, f.scopes[0], versions[0].files['payload.txt'].id),
  )
})

test('retention protects current generations, explicit review pins and transitive inputs; dry run matches cleanup', async (t) => {
  const f = await fixture(t),
    [scope] = f.scopes,
    versions = []
  for (let i = 0; i < 5; i++) versions.push(await f.publish('version ' + i))
  await f.run('artifacts.pin', {
    namespace: 'map',
    generationId: versions[1].id,
    enabled: true,
  })
  await f.publish('dependent', 'objects', [versions[0].files['payload.txt']])
  const plan = await f.inspect()
  assert.equal(plan.generations, 2)
  assert.equal(plan.references, 2)
  assert.equal(plan.blobs, 2)
  const actual = await f.run('artifacts.prune')
  assert.deepEqual({ ...actual, dryRun: true }, plan)
  await assert.rejects(
    f.store.resolve(actor, scope, versions[2].files['payload.txt'].id),
  )
  for (const i of [0, 1, 4])
    assert.equal(
      (await f.store.resolve(actor, scope, versions[i].files['payload.txt'].id))
        .reference.generationId,
      versions[i].id,
    )
  await f.run('artifacts.pin', {
    namespace: 'map',
    generationId: versions[1].id,
    enabled: false,
  })
  f.advance(60 * 60_000)
  assert.equal((await f.inspect()).generations, 1)
})

test('foreign scope references protect shared bytes and unavailable scope authority prevents global blob sweeping', async (t) => {
  const f = await fixture(t, true),
    [alpha, beta] = f.scopes
  const first = await f.publish('shared')
  const other = await f.publish('shared', 'map', [], beta)
  await f.publish('next')
  await f.publish('latest')
  f.advance(2 * day)
  f.deny('beta')
  const removed = await f.run('artifacts.prune')
  assert.equal(removed.generations, 2)
  assert.equal(removed.blobs, 0)
  await assert.rejects(
    f.store.resolve(actor, alpha, first.files['payload.txt'].id),
  )
  f.deny('')
  assert.equal(
    (await f.store.resolve(actor, beta, other.files['payload.txt'].id))
      .reference.sha256,
    first.files['payload.txt'].sha256,
  )
  f.deny('all')
  await assert.rejects(f.inspect(), (error) => error.code === 'NOT_FOUND')
})

test('active reads block maintenance until released; completed reads have no retention timer', async (t) => {
  const f = await fixture(t),
    [scope] = f.scopes
  const old = await f.publish('old')
  await f.publish('middle')
  await f.publish('new')
  f.advance(2 * day)
  await f.store.resolve(actor, scope, old.files['payload.txt'].id)
  assert.equal((await f.inspect()).generations, 2)
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers()
  const reading = f.store.withGeneration(
    actor,
    scope,
    'map',
    old.id,
    async () => {
      entered.resolve()
      await release.promise
    },
  )
  await entered.promise
  const entered2 = Promise.withResolvers(),
    release2 = Promise.withResolvers()
  const reading2 = f.store.withGeneration(
    actor,
    scope,
    'map',
    old.id,
    async () => {
      entered2.resolve()
      await release2.promise
    },
  )
  await entered2.promise
  f.advance(day)
  await assert.rejects(f.inspect(), (error) => error.code === 'BUSY')
  release.resolve()
  await reading
  await assert.rejects(f.inspect(), (error) => error.code === 'BUSY')
  release2.resolve()
  await reading2
  f.advance(60 * 60_000)
  const other = createArtifactStore({
    root: path.join(f.root, 'artifacts'),
    registrations: f.registrations,
    can: () => Promise.resolve(true),
  })
  t.after(() => other.dispose())
  await other.active(actor, scope, 'map', '')
  await assert.rejects(f.inspect(), (error) => error.code === 'BUSY')
  await other.dispose()
  assert.equal((await f.inspect()).generations, 2)
})

test('denied maintenance does not initialize the artifact root', async (t) => {
  const f = await fixture(t)
  f.deny('all')
  await assert.rejects(f.inspect(), (error) => error.code === 'NOT_FOUND')
  await assert.rejects(
    fs.access(path.join(f.root, 'artifacts')),
    (error) => error.code === 'ENOENT',
  )
})

test('store-wide cleanup requires every scope and preserves shared bytes still used by another head', async (t) => {
  const f = await fixture(t, true)
  const shared = await f.publish('shared')
  const other = await f.publish('shared', 'map', [], f.scopes[1])
  await f.publish('replacement')
  f.deny('beta')
  await assert.rejects(
    f.run('artifacts.store.prune'),
    (error) => error.code === 'NOT_FOUND',
  )
  assert(
    await f.store.resolve(actor, f.scopes[0], shared.files['payload.txt'].id),
  )
  f.deny('')
  const result = await f.run('artifacts.store.prune')
  assert.equal(result.generations, 1)
  assert.equal(result.blobs, 0)
  assert.equal(result.retained.length, 2)
  assert(result.retained.every((row) => row.reasons.includes('current')))
  assert(
    await f.store.resolve(actor, f.scopes[1], other.files['payload.txt'].id),
  )
  await f.publish('beta replacement', 'map', [], f.scopes[1])
  assert.equal((await f.run('artifacts.store.prune')).blobs, 1)
})

test('store-wide maintenance is absent from default app operations', async (t) => {
  const f = await fixture(t)
  assert(
    !artifactMaintenanceDefinitions(f.store).some((definition) =>
      definition.name.includes('.store.'),
    ),
  )
})

test('missing retained bytes stop cleanup before any obsolete generation is removed', async (t) => {
  const f = await fixture(t)
  const old = await f.publish('old')
  const current = await f.publish('current')
  const digest = current.files['payload.txt'].sha256
  await fs.unlink(
    path.join(f.root, 'artifacts/blobs', digest.slice(0, 2), digest),
  )
  await assert.rejects(f.run('artifacts.prune'))
  assert(await f.store.resolve(actor, f.scopes[0], old.files['payload.txt'].id))
})

test('a newly added review pin invalidates the deletion plan', async (t) => {
  const f = await fixture(t)
  const old = await f.publish('old')
  await f.publish('current')
  let added = false
  f.revokeWhen(async () => {
    if (
      !added &&
      (await fs
        .stat(path.join(f.root, 'artifacts/retention.lock'))
        .catch(() => null))
    ) {
      added = true
      const folder = path.join(f.root, 'artifacts/pins/local/alpha')
      await fs.mkdir(folder, { recursive: true })
      await fs.writeFile(
        path.join(folder, old.id + '.json'),
        JSON.stringify({
          schema: 1,
          scope: f.scopes[0],
          generationId: old.id,
          namespace: 'map',
          pinnedAt: new Date().toISOString(),
        }),
      )
    }
    return false
  })
  await assert.rejects(f.run('artifacts.prune'))
  assert(added)
  assert(await f.store.resolve(actor, f.scopes[0], old.files['payload.txt'].id))
})

test('unknown temporary scopes prevent a store-wide sweep and protect scoped orphan bytes', async (t) => {
  const f = await fixture(t)
  await f.publish('current')
  f.fail(true)
  await assert.rejects(f.publish('orphan'))
  f.fail(false)
  const folder = path.join(f.root, 'artifacts/references/local/foreign')
  await fs.mkdir(folder, { recursive: true })
  const pending = path.join(
    folder,
    hash('pending') + '.json.' + randomUUID() + '.tmp',
  )
  await fs.writeFile(pending, '{}')
  await assert.rejects(f.run('artifacts.store.prune'))
  const result = await f.run('artifacts.prune')
  assert.equal(result.blobs, 0)
  assert.equal(await fs.readFile(pending, 'utf8'), '{}')
})

test('local CLI discovers legacy scopes and previews before applying the shared policy', async (t) => {
  const f = await fixture(t, true)
  await f.publish('old alpha')
  await f.publish('current alpha')
  await f.publish('old beta', 'map', [], f.scopes[1])
  await f.publish('current beta', 'map', [], f.scopes[1])
  await f.store.dispose()
  await fs.mkdir(path.join(f.root, '.cache/workspace'), { recursive: true })
  await fs.rename(
    path.join(f.root, 'artifacts'),
    path.join(f.root, '.cache/workspace/artifacts'),
  )
  const abort = new AbortController()
  await assert.rejects(
    cleanArtifacts(f.root, {
      allScopes: true,
      apply: true,
      signal: abort.signal,
      emit: (value) => {
        if (value.phase === 'plan') abort.abort()
      },
    }),
    (error) => error.code === 'CANCELLED',
  )
  assert.equal(
    (await cleanArtifacts(f.root, { allScopes: true })).generations,
    2,
  )
  const observations = []
  const result = await cleanArtifacts(f.root, {
    allScopes: true,
    apply: true,
    emit: (value) => observations.push(value),
  })
  assert.deepEqual(
    observations.map((row) => row.phase),
    ['plan', 'result'],
  )
  assert.equal(result.generations, 2)
  assert.equal(result.retained.length, 2)
  assert.equal((await cleanArtifacts(f.root, { allScopes: true })).bytes, 0)
})

test('large stores exceed the old reference and aggregate JSON limits without weakening per-record checks', async (t) => {
  const f = await fixture(t)
  const old = await f.publish('old')
  await f.publish('current')
  const folder = path.join(f.root, 'artifacts/references/local/alpha')
  const template = old.files['payload.txt']
  let total = 0
  for (let offset = 0; offset < 50_001; offset += 64) {
    await Promise.all(
      Array.from({ length: Math.min(64, 50_001 - offset) }, async (_, i) => {
        const id = hash('old reference ' + (offset + i))
        const value =
          JSON.stringify({
            ...template,
            id,
            url: template.url.replace(template.id, id),
          }) + '\n'.repeat(1024)
        total += Buffer.byteLength(value)
        await fs.writeFile(path.join(folder, id + '.json'), value)
      }),
    )
  }
  assert(total > 64 * 1024 * 1024)
  const plan = await f.inspect()
  assert.equal(plan.references, 50_002)
  assert.equal((await fs.readdir(folder)).length, 50_003)
  const result = await f.run('artifacts.prune')
  assert.deepEqual({ ...result, dryRun: true }, plan)
  assert.equal((await fs.readdir(folder)).length, 1)
})

test('revocation during cleanup leaves a committed-stage record without touching active data', async (t) => {
  const f = await fixture(t)
  for (let i = 0; i < 5; i++) await f.publish('revision ' + i)
  f.advance(2 * day)
  const references = path.join(f.root, 'artifacts/references/local/alpha'),
    before = (await fs.readdir(references)).length
  f.revokeWhen(async () => (await fs.readdir(references)).length < before)
  await assert.rejects(f.run('artifacts.prune'))
  f.revokeWhen(undefined)
  const activity = await f.service.query(
    actor,
    f.scopes[0],
    'activity.read',
    {},
  )
  assert(
    activity.history[0].stages.some(
      (stage) =>
        stage.name === 'artifact-cleanup:references' && stage.committed,
    ),
  )
  const active = await f.store.active(actor, f.scopes[0], 'map')
  assert(
    await f.store.resolve(actor, f.scopes[0], active.files['payload.txt'].id),
  )
})

test('cleanup refuses excessive metadata before parsing or deleting any candidate', async (t) => {
  const f = await fixture(t),
    published = await f.publish('active')
  const file = path.join(
    f.root,
    'artifacts/generations/local/alpha',
    randomUUID() + '.json',
  )
  const handle = await fs.open(file, 'wx')
  await handle.truncate(64 * 1024 * 1024 + 1)
  await handle.close()
  f.advance(2 * day)
  await assert.rejects(
    f.run('artifacts.prune'),
    (error) => error.code === 'CAPACITY_REACHED',
  )
  assert.equal(
    (await f.store.active(actor, f.scopes[0], 'map', '')).id,
    published.id,
  )
  assert.equal((await fs.stat(file)).size, 64 * 1024 * 1024 + 1)
})

test('failed publication orphans and abandoned staging are immediately eligible; live writers block maintenance', async (t) => {
  const f = await fixture(t)
  await f.publish('kept')
  f.fail(true)
  await assert.rejects(f.publish('orphan'))
  f.fail(false)
  const staging = path.join(f.root, 'artifacts/staging')
  await fs.mkdir(staging, { recursive: true })
  const disposable = path.join(staging, randomUUID())
  await fs.writeFile(disposable, 'unfinished bytes')
  assert.equal((await f.inspect()).blobs, 1)
  assert.equal((await f.inspect()).temporary, 1)
  const gate = Promise.withResolvers()
  const entered = f.hold(gate)
  const publishing = f.publish('held')
  await Promise.race([
    entered,
    publishing.then(() => {
      throw new Error('Publisher did not enter its held stage')
    }),
  ])
  try {
    await assert.rejects(f.inspect(), (error) => error.code === 'BUSY')
  } finally {
    gate.resolve()
  }
  await publishing
})

test('unexpected store entries stop cleanup, and equal-length blob corruption is rejected instead of served', async (t) => {
  const f = await fixture(t),
    [scope] = f.scopes
  const generation = await f.publish('payload')
  const ref = generation.files['payload.txt'],
    blob = path.join(
      f.root,
      'artifacts/blobs',
      ref.sha256.slice(0, 2),
      ref.sha256,
    )
  await f.store.resolve(actor, scope, ref.id)
  await fs.writeFile(blob, 'changed')
  await assert.rejects(f.store.resolve(actor, scope, ref.id))
  await assert.rejects(f.publish('payload'))
  const outside = path.join(f.root, 'personal-world')
  await fs.writeFile(outside, 'preserve')
  await fs.symlink(outside, path.join(f.root, 'artifacts/blobs/unrecognized'))
  f.advance(2 * day)
  await assert.rejects(
    f.run('artifacts.prune'),
    (error) => error.code === 'STORAGE_UNAVAILABLE',
  )
  assert.equal(await fs.readFile(outside, 'utf8'), 'preserve')
  assert.equal(
    (await f.store.active(actor, scope, 'map', '')).id,
    generation.id,
  )
})
