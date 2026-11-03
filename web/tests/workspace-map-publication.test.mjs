import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { z } from 'zod'
import { domains } from '../src/lib/domains.mjs'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { mapDefinitions } from '../scripts/workspace/map.ts'
import { compileInputs } from '../scripts/compile.mjs'
import { mapProjectionDefinitions } from '../scripts/workspace/map-projection.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { hash } from '../scripts/workspace/identity.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'

test('failed real compiler preserves acknowledged source and the last active map generation', async (t) => {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-map-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: directory,
    pack: directory,
  }
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  await fs.mkdir(path.join(directory, 'data/authored'), { recursive: true })
  await fs.mkdir(path.join(directory, 'src/lib'), { recursive: true })
  await fs.mkdir(path.join(directory, 'candidate'))
  for (const name of domains)
    await fs.writeFile(
      path.join(directory, 'data/authored', name + '.yml'),
      name === 'recipes' ? 'schema: 1\nchanges: []\n' : 'schema: 1\n',
    )
  const catalog = path.join(directory, 'candidate/catalog.json')
  await fs.writeFile(catalog, '{"previous":true}')
  let service
  const native = createNativeExecutor({ session: () => service.session })
  const artifacts = createArtifactStore({
    root: path.join(directory, '.cache/artifacts'),
    registrations: [registration],
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: [
      ...mapDefinitions([registration]),
      ...mapProjectionDefinitions(artifacts, native),
      defineOperation({
        name: 'fixture.generate',
        effect: 'generate',
        input: z.strictObject({}),
        output: z.unknown(),
        targets: () => [],
        label: 'Seed fixture',
        href: '/',
        success: 'Ready',
        execute: (ctx) =>
          artifacts.publish(ctx, {
            namespace: 'map',
            staging: path.dirname(catalog),
            files: { 'catalog.json': catalog },
            inputs: { fixture: hash('old') },
            recheck: async () => {},
          }),
      }),
    ],
    shutdown: () => native.dispose(),
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(directory, { recursive: true, force: true })
  })
  async function command(operation, payload) {
    const commandId = randomUUID()
    const admitted = await service.submit(actor, {
      v: 1,
      type: 'command',
      requestId: randomUUID(),
      commandId,
      session: service.session,
      createdAt: new Date().toISOString(),
      scope: registration.scope,
      operation,
      payload,
    })
    return { commandId, ...(await admitted.outcome) }
  }
  const initial = (await command('fixture.generate', {})).payload
  const before = await service.query(
    actor,
    registration.scope,
    'map.sources.read',
    {},
  )
  const text = 'schema: 1\nchanges: []\n# saved before compile\n'
  const saved = await command('map.source.save', {
    name: 'recipes',
    text,
    revision: before.files.recipes.revision,
  })
  assert.equal(saved.operation.state, 'succeeded')
  const sources = await service.query(
    actor,
    registration.scope,
    'map.sources.read',
    {},
  )
  const failed = await command('map.compile', { revision: sources.revision })
  assert.equal(failed.operation.state, 'failed')
  assert.match(failed.error.message, /Cannot find module/)
  assert.ok(!failed.error.message.includes(directory))
  assert.equal(failed.operation.stages.length, 0)
  assert.equal(
    (await artifacts.active(actor, registration.scope, 'map')).id,
    initial.id,
  )
  assert.equal(
    await fs.readFile(
      path.join(directory, 'data/authored/recipes.yml'),
      'utf8',
    ),
    text,
  )
  assert.equal(
    (
      await service.commandOutcome(
        actor,
        registration.scope,
        service.session,
        saved.commandId,
      )
    ).state,
    'succeeded',
  )
  assert.deepEqual(
    await fs.readdir(path.join(directory, '.cache/workspace/staging')),
    [],
  )
})

async function nativeFixture(t, { paused = false, policy } = {}) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-native-map-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: directory,
    pack: directory,
  }
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  await fs.mkdir(path.join(directory, 'scripts'), { recursive: true })
  await fs.mkdir(path.join(directory, 'src/lib'), { recursive: true })
  await fs.mkdir(path.join(directory, 'data/authored'), { recursive: true })
  await fs.mkdir(path.join(directory, 'data/generated/runtime'), {
    recursive: true,
  })
  await fs.symlink(
    path.resolve('node_modules'),
    path.join(directory, 'node_modules'),
  )
  for (const file of [
    'compile.mjs',
    'configuration.mjs',
    'export_patch.py',
    'paths.py',
  ])
    await fs.copyFile(
      path.resolve('scripts', file),
      path.join(directory, 'scripts', file),
    )
  for (const file of (await fs.readdir('src/lib')).filter((name) =>
    name.endsWith('.mjs'),
  ))
    await fs.copyFile(
      path.resolve('src/lib', file),
      path.join(directory, 'src/lib', file),
    )
  await fs.copyFile('pnpm-lock.yaml', path.join(directory, 'pnpm-lock.yaml'))
  if (paused) {
    const compiler = path.join(directory, 'scripts/compile.mjs')
    await fs.writeFile(
      compiler,
      `import fixtureFs from 'node:fs';
fixtureFs.writeFileSync('worker-started', 'yes');
const fixtureDeadline = Date.now() + 5000;
while (!fixtureFs.existsSync('release-worker')) {
  if (Date.now() > fixtureDeadline) throw new Error('fixture timed out');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
}
` + (await fs.readFile(compiler, 'utf8')),
    )
  }
  for (const name of domains) {
    const source = {
      schema: 1,
      ...(name === 'recipes'
        ? { changes: [{ id: 'minecraft:fixture', disabled: true }] }
        : name === 'items'
          ? { notes: {} }
          : name === 'progression'
            ? { roots: ['minecraft:stone'], machines: {} }
            : { records: [] }),
    }
    await fs.writeFile(
      path.join(directory, 'data/authored', name + '.yml'),
      JSON.stringify(source),
    )
  }
  for (const name of compileInputs) {
    const value =
      name === 'catalog'
        ? [
            {
              id: 'minecraft:stone',
              name: 'Stone',
              mod: 'minecraft',
              class: 'BlockItem',
              tags: [],
            },
          ]
        : [
              'documents',
              'runtime/loot',
              'runtime/advancements',
              'runtime/resources',
              'runtime/snapshot',
            ].includes(name)
          ? {}
          : name === 'runtime/complete'
            ? { minecraft: '1.21.1', time: 'fixture' }
            : ['world', 'structures', 'islands'].includes(name)
              ? null
              : []
    await fs.writeFile(
      path.join(directory, 'data/generated', name + '.json'),
      JSON.stringify(value),
    )
  }
  let service
  const native = createNativeExecutor({ session: () => service.session })
  const artifacts = createArtifactStore({
    root: path.join(directory, '.cache/artifacts'),
    registrations: [registration],
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: [
      ...mapDefinitions([registration]),
      ...mapProjectionDefinitions(artifacts, native),
    ],
    policy,
    shutdown: () => native.dispose(),
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(directory, { recursive: true, force: true })
  })
  const query = (name, payload = {}) =>
    service.query(actor, registration.scope, name, payload)
  const command = async (operation, payload) =>
    (
      await service.submit(actor, {
        v: 1,
        type: 'command',
        requestId: randomUUID(),
        commandId: randomUUID(),
        session: service.session,
        createdAt: new Date().toISOString(),
        scope: registration.scope,
        operation,
        payload,
      })
    ).outcome
  return {
    directory,
    registration,
    actor,
    native,
    artifacts,
    service,
    query,
    command,
  }
}

test('named compiler leaves reads responsive and publishes the saved scenario as a scoped checked ZIP', async (t) => {
  const f = await nativeFixture(t, { paused: true }),
    sources = await f.query('map.sources.read')
  const work = f.command('scenario.export', { revision: sources.revision })
  const started = path.join(f.directory, 'worker-started')
  const deadline = Date.now() + 5000
  while (
    !(await fs.stat(started).then(
      () => true,
      () => false,
    ))
  ) {
    assert.ok(Date.now() < deadline, 'native compiler did not start')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal((await f.query('map.sources.read')).revision, sources.revision)
  assert.ok((await f.query('activity.read')).current)
  await fs.writeFile(path.join(f.directory, 'release-worker'), 'yes')
  const result = await work
  assert.equal(result.operation.state, 'succeeded', result.error?.message)
  assert.ok(
    result.operation.stages.some((stage) => stage.name === 'projection:map'),
  )
  assert.ok(
    result.operation.stages.some(
      (stage) => stage.name === 'projection:scenario',
    ),
  )
  const resolved = await f.artifacts.resolve(
    f.actor,
    f.registration.scope,
    result.payload.id,
  )
  assert.equal(result.payload.mediaType, 'application/zip')
  assert.ok(
    (await fs.readFile(resolved.file)).subarray(0, 2).equals(Buffer.from('PK')),
  )
  const map = await f.artifacts.active(f.actor, f.registration.scope, 'map')
  const catalogFile = await f.artifacts.resolve(
    f.actor,
    f.registration.scope,
    map.files['catalog.json'].id,
  )
  const catalog = JSON.parse(await fs.readFile(catalogFile.file, 'utf8'))
  assert.equal(catalog.nodes[0].id, 'minecraft:stone')
  assert.deepEqual(
    await fs.readdir(path.join(f.directory, '.cache/workspace/staging')),
    [],
  )
  await assert.rejects(
    fs.stat(
      path.join(f.directory, 'public/generated/create-sky-atlas-patch.zip'),
    ),
    { code: 'ENOENT' },
  )
})

test('edits during native compilation reject publication and preserve the prior map', async (t) => {
  const f = await nativeFixture(t),
    sources = await f.query('map.sources.read')
  const first = await f.command('map.compile', { revision: sources.revision })
  assert.equal(first.operation.state, 'succeeded', first.error?.message)
  let edited = false
  const unsubscribe = f.native.runner.subscribe((snapshot) => {
    if (!edited && snapshot.current?.name === 'map.compile') {
      edited = true
      // Synchronous external editor write occurs after inputs were captured, before publication.
      appendFileSync(path.join(f.directory, 'data/authored/recipes.yml'), '\n')
    }
  })
  const second = await f.command('map.compile', { revision: sources.revision })
  unsubscribe()
  assert.equal(second.error.code, 'REVISION_CONFLICT')
  assert.equal(
    (await f.artifacts.active(f.actor, f.registration.scope, 'map')).id,
    first.payload.generationId,
  )
})

test('denied runtime inputs never dispatch a compiler', async (t) => {
  const f = await nativeFixture(t, {
    policy: {
      mode: 'restricted',
      decide: (_ctx, action, target) => ({
        allowed: !(action === 'source.read' && target.id === 'runtime:catalog'),
      }),
    },
  })
  const sources = await f.query('map.sources.read')
  await assert.rejects(
    f.command('scenario.export', { revision: sources.revision }),
    /unavailable|permitted|authorized/,
  )
  assert.equal(f.native.runner.snapshot().last, null)
})
