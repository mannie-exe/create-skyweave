import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  createWorkspaceInventory,
  inventoryDefinitions,
} from '../scripts/workspace/inventory.ts'
import { createWorkspaceWatch } from '../scripts/workspace/watch.ts'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { mapDefinitions } from '../scripts/workspace/map.ts'
import { hash } from '../scripts/workspace/identity.ts'
import { domains } from '../src/lib/domains.mjs'

const actor = {
  principal: { kind: 'anonymous', id: 'local' },
  connectionId: randomUUID(),
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check) {
  const deadline = Date.now() + 8000
  while (!check()) {
    if (Date.now() > deadline)
      throw new Error('Expected watch observation did not arrive')
    await delay(50)
  }
}
function frame(service, scope, operation, payload = {}) {
  return {
    v: 1,
    type: 'command',
    requestId: randomUUID(),
    commandId: randomUUID(),
    session: service.session,
    createdAt: new Date().toISOString(),
    scope,
    operation,
    payload,
  }
}
async function fixture(t, definitions = []) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-watch-')),
  )
  let changes
  const registrations = await Promise.all(
    ['a', 'b'].map(async (packId) => {
      const pack = path.join(root, packId),
        web = path.join(pack, 'web')
      await fs.mkdir(path.join(web, 'data/authored'), { recursive: true })
      await fs.mkdir(path.join(web, 'scripts'), { recursive: true })
      await fs.mkdir(path.join(pack, 'authoring/quests/locales'), {
        recursive: true,
      })
      for (const domain of domains)
        await fs.writeFile(
          path.join(web, 'data/authored', domain + '.yml'),
          'schema: 1\n',
        )
      await fs.writeFile(path.join(pack, 'empack.yml'), 'schema: 1\n')
      await fs.writeFile(
        path.join(web, 'scripts/adapter.mjs'),
        'export const version = 1\n',
      )
      return { pack, web, scope: { workspaceId: 'local', packId } }
    }),
  )
  let service
  const inventory = createWorkspaceInventory(),
    artifacts = createArtifactStore({
      root: path.join(root, 'artifacts'),
      registrations,
      can: (...args) => service.can(...args),
    })
  let deny = ''
  service = createWorkspaceService({
    registrations,
    policy: {
      mode: 'restricted',
      decide(_actor, _action, target) {
        return target.id === deny
          ? { allowed: false, reason: 'forbidden' }
          : { allowed: true }
      },
    },
    definitions: [
      ...mapDefinitions(registrations),
      ...inventoryDefinitions(inventory, artifacts, (r) => changes.status(r)),
      ...definitions,
    ],
    guard: (ctx) => changes?.guard(ctx.registration),
  })
  changes = createWorkspaceWatch({
    registrations,
    inventory,
    service,
    manifestPath: (registration, namespace) =>
      artifacts.manifestPath(registration.scope, namespace),
  })
  t.after(async () => {
    await changes.dispose()
    await service.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  await changes.ready
  const events = []
  service.onEvent((e) => events.push(e))
  return {
    registrations,
    inventory,
    service,
    changes,
    events,
    deny(id) {
      deny = id
    },
    root,
    artifacts,
  }
}

test('inventory filters revisions before aggregation and excludes worlds, downloads, symlinks and temporary files', async (t) => {
  const f = await fixture(t),
    a = f.registrations[0]
  const first = await f.service.query(actor, a.scope, 'sources.inventory', {})
  assert.equal(first.monitoring, 'ready')
  assert(first.entries.some((e) => e.id === 'map:recipes' && e.writable))
  assert(first.entries.some((e) => e.id === 'pack:manifest' && !e.writable))
  await fs.mkdir(path.join(a.pack, 'world'), { recursive: true })
  await fs.writeFile(path.join(a.pack, 'world/secret.json'), 'private')
  await fs.writeFile(
    path.join(a.web, 'data/authored/ignored.tmp'),
    'not a source',
  )
  await fs.symlink(
    path.join(a.pack, 'world/secret.json'),
    path.join(a.web, 'data/authored/symlink.json'),
  )
  const next = await f.service.query(actor, a.scope, 'sources.inventory', {})
  assert.equal(next.revision, first.revision)
  f.deny('map:recipes')
  const filtered = await f.service.query(
    actor,
    a.scope,
    'sources.inventory',
    {},
  )
  assert(!filtered.entries.some((e) => e.id === 'map:recipes'))
  await fs.writeFile(
    path.join(a.web, 'data/authored/recipes.yml'),
    'schema: 1\n# hidden change\n',
  )
  assert.equal(
    (await f.service.query(actor, a.scope, 'sources.inventory', {})).revision,
    filtered.revision,
  )
})

test('atomic external saves are scoped; own saves emit once, and a following external edit is not suppressed', async (t) => {
  const f = await fixture(t),
    a = f.registrations[0]
  const file = path.join(a.web, 'data/authored/recipes.yml'),
    text = 'schema: 1\n# atomic\n'
  await fs.writeFile(file + '.tmp', text)
  await fs.rename(file + '.tmp', file)
  await until(() =>
    f.events.some((e) => e.payload?.revisions?.['map:recipes'] === hash(text)),
  )
  assert(!f.events.some((e) => e.scope.packId === 'b'))
  f.events.length = 0
  const saved = 'schema: 1\nchanges: []\n# own save\n'
  const admission = await f.service.submit(
    actor,
    frame(f.service, a.scope, 'map.source.save', {
      name: 'recipes',
      revision: hash(text),
      text: saved,
    }),
  )
  const outcome = await admission.outcome
  assert.equal(
    outcome.operation.state,
    'succeeded',
    JSON.stringify(outcome.error),
  )
  await f.changes.reconcile(a)
  await delay(700)
  const sourceEvents = f.events.filter(
    (e) => e.topic === 'sources' && e.payload?.sources?.includes('map:recipes'),
  )
  assert.equal(sourceEvents.length, 1)
  assert.equal(sourceEvents[0].payload.operationId, outcome.operation.id)
  assert.equal(sourceEvents[0].payload.revisions['map:recipes'], hash(saved))
  f.events.length = 0
  const edited = 'schema: 1\n# after save\n'
  await fs.writeFile(file, edited)
  await until(() =>
    f.events.some(
      (e) =>
        e.payload?.external &&
        e.payload?.revisions?.['map:recipes'] === hash(edited),
    ),
  )
})

test('chunked writes settle before events and loaded-code changes require a restart only in their scope', async (t) => {
  const f = await fixture(t),
    [a, b] = f.registrations
  const file = path.join(a.web, 'data/authored/items.yml')
  await fs.writeFile(file, 'schema: 1\n')
  await delay(100)
  await fs.appendFile(file, '# partial\n')
  // Another settled file can trigger an inventory scan during this write.
  await f.changes.reconcile(a)
  await delay(100)
  assert(!f.events.some((e) => e.payload?.sources?.includes('map:items')))
  await fs.appendFile(file, '# settled\n')
  await until(() =>
    f.events.some((e) => e.payload?.sources?.includes('map:items')),
  )
  await fs.writeFile(
    path.join(a.web, 'scripts/adapter.mjs'),
    'export const version = 2\n',
  )
  await until(() => f.changes.status(a).restartRequired)
  const read = await f.service.query(actor, a.scope, 'sources.inventory', {})
  assert(read.restartRequired)
  await assert.rejects(
    f.service.submit(
      actor,
      frame(f.service, a.scope, 'map.source.save', {
        name: 'recipes',
        revision: hash('schema: 1\n'),
        text: 'schema: 1\n',
      }),
    ),
    (e) => e.code === 'CAPABILITY_UNAVAILABLE',
  )
  assert.equal(f.changes.status(b).restartRequired, false)
  assert.equal(
    (await f.service.query(actor, a.scope, 'activity.read', {})).current,
    null,
  )
})

test('publication barrier defers watcher observations until the complete source set is installed', async (t) => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers()
  const f = await fixture(t, [
      defineOperation({
        name: 'fixture.publish',
        effect: 'generate',
        input: z.strictObject({}),
        output: z.boolean(),
        label: 'fixture',
        href: '/',
        success: '',
        targets: () => [],
        async execute(ctx) {
          return ctx.publishInputs(async () => {
            await fs.writeFile(
              path.join(ctx.registration.web, 'data/authored/recipes.yml'),
              'schema: 1\n# candidate\n',
            )
            entered.resolve()
            await release.promise
            return true
          })
        },
      }),
    ]),
    a = f.registrations[0]
  const admitted = await f.service.submit(
    actor,
    frame(f.service, a.scope, 'fixture.publish'),
  )
  await Promise.race([
    entered.promise,
    admitted.outcome.then(() => {
      throw new Error('Publisher stopped before entering its fixture')
    }),
  ])
  try {
    await f.changes.reconcile(a)
    await delay(500)
    assert(!f.events.some((e) => e.payload?.sources?.includes('map:recipes')))
    await assert.rejects(
      f.service.query(actor, a.scope, 'sources.inventory', {}),
      (e) => e.code === 'BUSY',
    )
  } finally {
    release.resolve()
  }
  assert.equal((await admitted.outcome).operation.state, 'succeeded')
  await until(() =>
    f.events.some((e) => e.payload?.sources?.includes('map:recipes')),
  )
})

test('active manifests drive scoped projection inventories and removals without watching generated assets', async (t) => {
  const f = await fixture(t),
    a = f.registrations[0]
  const file = f.artifacts.manifestPath(a.scope, 'objects')
  await fs.mkdir(path.dirname(file), { recursive: true })
  const generation = {
    schema: 1,
    id: randomUUID(),
    scope: a.scope,
    namespace: 'objects',
    inputRevision: hash('inputs'),
    inputs: {},
    files: {},
    dependencies: [],
    publishedAt: new Date().toISOString(),
  }
  await fs.writeFile(file, JSON.stringify(generation))
  await until(() =>
    f.events.some(
      (event) =>
        event.topic === 'projections' &&
        event.payload.generationId === generation.id,
    ),
  )
  assert(
    !f.events.some(
      (event) => event.topic === 'projections' && event.scope.packId === 'b',
    ),
  )
  const current = await f.service.query(
    actor,
    a.scope,
    'projections.inventory',
    {},
  )
  assert.equal(current.entries[0].generationId, generation.id)
  assert(!JSON.stringify(current).includes(f.root))
  for (let i = 0; i < 3; i++) {
    generation.id = randomUUID()
    await fs.writeFile(file + '.tmp', JSON.stringify(generation))
    await fs.rename(file + '.tmp', file)
    await until(() =>
      f.events.some(
        (event) =>
          event.topic === 'projections' &&
          event.payload.generationId === generation.id,
      ),
    )
    assert.equal(
      (await f.service.query(actor, a.scope, 'projections.inventory', {}))
        .entries[0].generationId,
      generation.id,
    )
  }
  f.deny('objects')
  const denied = await f.service.query(
    actor,
    a.scope,
    'projections.inventory',
    {},
  )
  assert.deepEqual(denied.entries, [])
  f.deny('')
  f.events.length = 0
  await fs.rm(file)
  await until(() =>
    f.events.some(
      (event) =>
        event.topic === 'projections' &&
        event.payload.namespace === 'objects' &&
        event.payload.generationId === null,
    ),
  ).catch((error) => {
    throw new Error(
      JSON.stringify({
        message: error.message,
        status: f.changes.status(a),
        events: f.events.map((event) => ({
          topic: event.topic,
          payload: event.payload,
        })),
      }),
    )
  })
})

test('watch hints stay coalesced while an inventory scan is slow', async (t) => {
  const f = await fixture(t),
    a = f.registrations[0]
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers()
  const original = f.inventory.scan
  let calls = 0,
    active = 0,
    maximum = 0
  f.inventory.scan = async (...args) => {
    calls++
    active++
    maximum = Math.max(maximum, active)
    try {
      if (calls === 1) {
        entered.resolve()
        await release.promise
      }
      return await original(...args)
    } finally {
      active--
    }
  }
  const file = path.join(a.web, 'data/authored/items.yml')
  await fs.writeFile(file, 'schema: 1\n# first\n')
  await entered.promise
  try {
    for (let i = 0; i < 4; i++) {
      await fs.writeFile(file, `schema: 1\n# batch ${i}\n`)
      await delay(250)
    }
    assert.equal(calls, 1)
  } finally {
    release.resolve()
  }
  await until(() =>
    f.events.some(
      (event) =>
        event.payload?.revisions?.['map:items'] ===
        hash('schema: 1\n# batch 3\n'),
    ),
  )
  assert.equal(maximum, 1)
  // One follow-up observes the same settled revision; no chain of old hints.
  assert(calls <= 3)
})

test('native FTB definitions and their exact ownership manifest participate in revisions without admitting other hidden files', async (t) => {
  const f = await fixture(t),
    registration = f.registrations[0]
  const folder = path.join(
    registration.pack,
    'overrides/common/config/ftbquests/quests',
  )
  await fs.mkdir(path.join(folder, 'chapters'), { recursive: true })
  await fs.writeFile(
    path.join(folder, 'chapters/review.snbt'),
    '{ id: "0000000000000001" }',
  )
  await fs.writeFile(
    path.join(folder, '.skyweave-generated.json'),
    '{"schema":1}',
  )
  await fs.writeFile(path.join(folder, '.private.json'), 'must remain hidden')
  const first = await f.service.query(
    actor,
    registration.scope,
    'sources.inventory',
    {},
  )
  const source = first.entries.find(
    (row) => row.id === 'generated:quests:chapters/review.snbt',
  )
  const manifest = first.entries.find(
    (row) => row.id === 'generated:quests:.skyweave-generated.json',
  )
  assert.ok(source && !source.writable)
  assert.ok(manifest && !manifest.writable)
  assert.ok(!first.entries.some((row) => row.id.includes('.private')))
  await fs.appendFile(
    path.join(folder, 'chapters/review.snbt'),
    '\n// Native edit',
  )
  const second = await f.service.query(
    actor,
    registration.scope,
    'sources.inventory',
    {},
  )
  assert.notEqual(
    second.entries.find((row) => row.id === source.id).revision,
    source.revision,
  )
})
