import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { materializeStatic } from '../scripts/workspace/static.ts'
import { readJSONArtifact } from '../src/lib/workspace/artifacts.ts'
import { safeIcon } from '../src/lib/recipe-view.mjs'
import { hash } from '../scripts/workspace/identity.ts'

async function fixture(t) {
  const root = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-static-')),
    ),
    registration = {
      scope: { workspaceId: 'local', packId: 'fixture' },
      web: root,
      pack: root,
    },
    actor = {
      principal: { kind: 'anonymous', id: 'fixture' },
      connectionId: randomUUID(),
    },
    staging = path.join(root, 'candidate'),
    output = path.join(root, 'dist')
  await fs.mkdir(staging)
  await fs.mkdir(output)
  let service, definition
  const store = createArtifactStore({
    root: path.join(root, '.cache/workspace/artifacts'),
    registrations: [registration],
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: [
      defineOperation({
        name: 'fixture.publish',
        effect: 'generate',
        input: z.strictObject({}),
        output: z.unknown(),
        targets: () => [],
        label: 'Fixture',
        href: '/',
        success: '',
        execute: (ctx) =>
          store.publish(ctx, {
            staging,
            inputs: { fixture: hash('inputs') },
            recheck: async () => {},
            ...definition,
          }),
      }),
    ],
  })
  t.after(async () => {
    await service.dispose()
    await store.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  return {
    root,
    output,
    registration,
    async publish(namespace, files, rewriteJSON, dependencies = []) {
      const sources = {}
      for (const [name, value] of Object.entries(files)) {
        const file = path.join(staging, name)
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(
          file,
          typeof value === 'string' || Buffer.isBuffer(value)
            ? value
            : JSON.stringify(value),
        )
        sources[name] = file
      }
      definition = { namespace, files: sources, rewriteJSON, dependencies }
      const admitted = await service.submit(actor, {
        v: 1,
        type: 'command',
        requestId: randomUUID(),
        commandId: randomUUID(),
        session: service.session,
        createdAt: new Date().toISOString(),
        scope: registration.scope,
        operation: 'fixture.publish',
        payload: {},
      })
      const result = await admitted.outcome
      assert(!result.error, JSON.stringify(result.error))
      return result.payload
    },
    async build(extra = {}) {
      return materializeStatic({
        registration,
        output,
        namespaces: ['map', 'objects', 'texture-resources'],
        ...extra,
      })
    },
  }
}

test('static materialization uses active scoped bytes, rewrites links and descriptors, and excludes private projections', async (t) => {
  const f = await fixture(t)
  const generation = await f.publish(
    'map',
    {
      'icons/abcd.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      'catalog.json': { nodes: [{ icon: 'icon' }], descriptors: [] },
    },
    (value, references, logical) =>
      logical === 'catalog.json'
        ? {
            ...value,
            nodes: [{ icon: references['icons/abcd.png'].url }],
            descriptors: [
              references['icons/abcd.png'],
              references['icons/abcd.png'],
            ],
          }
        : value,
  )
  await f.publish('native-models', {
    'inputs.json': { private: '/Users/secret/context' },
  })
  await fs.mkdir(path.join(f.output, 'generated/resource-review'), {
    recursive: true,
  })
  await fs.writeFile(
    path.join(f.output, 'generated/catalog.json'),
    '{"stale":true}',
  )
  await fs.writeFile(path.join(f.output, 'generated/private.json'), 'private')
  await fs.writeFile(
    path.join(f.output, 'generated/resource-review/kept.png'),
    'reviewed media',
  )
  const manifest = await f.build()
  assert.equal(manifest.delivery, 'open-static')
  assert.equal(manifest.public, true)
  assert.deepEqual(manifest.scope, f.registration.scope)
  assert.equal(manifest.projections.map.generationId, generation.id)
  assert.deepEqual(manifest.unavailable, ['objects', 'texture-resources'])
  const reference = manifest.projections.map.files['catalog.json'],
    bytes = await fs.readFile(path.join(f.output, reference.url)),
    catalog = JSON.parse(bytes)
  assert.equal(hash(bytes), reference.sha256)
  assert.equal(bytes.length, reference.byteLength)
  assert.match(
    catalog.nodes[0].icon,
    /^\/workspace-snapshot\/local\/fixture\/assets\/.*\.png$/,
  )
  assert.equal(safeIcon(catalog.nodes[0].icon), catalog.nodes[0].icon)
  assert.deepEqual(
    catalog.descriptors[0],
    manifest.projections.map.files['icons/abcd.png'],
  )
  assert(!bytes.includes('/__atlas/'))
  assert.deepEqual(
    await fs.readFile(path.join(f.output, 'generated/catalog.json')),
    bytes,
  )
  assert.equal(
    await fs.readFile(
      path.join(f.output, 'generated/resource-review/kept.png'),
      'utf8',
    ),
    'reviewed media',
  )
  await assert.rejects(fs.access(path.join(f.output, 'generated/private.json')))
  assert(!JSON.stringify(manifest).includes('native-models'))
  assert(!JSON.stringify(manifest).includes(f.root))
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, reference.url)
    return new Response(bytes, {
      headers: { 'Content-Type': 'application/json' },
    })
  })
  assert.deepEqual(await readJSONArtifact(reference), catalog)
  await assert.rejects(
    readJSONArtifact({
      ...reference,
      url: reference.url.replace('fixture', 'other'),
    }),
  )
})

test('static build rejects restricted delivery, private files and dangling scope links without replacing prior output', async (t) => {
  const f = await fixture(t)
  await assert.rejects(
    f.build({
      policy: { mode: 'restricted', decide: () => ({ allowed: true }) },
    }),
    /protected delivery/,
  )
  await f.publish('map', { 'catalog.json': { current: true } })
  await f.build()
  const before = await fs.readFile(
    path.join(f.output, 'workspace-snapshot/manifest.json'),
  )
  await assert.rejects(
    f.build({
      recheck: async () => {
        throw new Error('inputs changed')
      },
    }),
    /inputs changed/,
  )
  assert.deepEqual(
    await fs.readFile(path.join(f.output, 'workspace-snapshot/manifest.json')),
    before,
  )
  await f.publish('objects', {
    'index.json': {},
    'inputs.json': { private: 'native' },
  })
  await assert.rejects(f.build(), /Unadmitted file/)
  await f.publish('objects', {
    'index.json': {
      url:
        '/__atlas/workspaces/local/packs/foreign/artifacts/' + 'a'.repeat(64),
    },
  })
  await assert.rejects(f.build(), /unadmitted resource link/)
  assert.deepEqual(
    await fs.readFile(path.join(f.output, 'workspace-snapshot/manifest.json')),
    before,
  )
  assert(
    !(await fs.readdir(f.output)).some((name) =>
      name.startsWith('.atlas-static-'),
    ),
  )
})

test('empty static builds declare missing projections and do not silently serve legacy generated data', async (t) => {
  const f = await fixture(t)
  await fs.mkdir(path.join(f.output, 'generated'))
  await fs.writeFile(path.join(f.output, 'generated/catalog.json'), 'stale')
  const result = await f.build()
  assert.deepEqual(result.projections, {})
  assert.deepEqual(result.unavailable, ['map', 'objects', 'texture-resources'])
  await assert.rejects(fs.access(path.join(f.output, 'generated/catalog.json')))
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(f.output, 'workspace-snapshot/manifest.json'),
      ),
    ).delivery,
    'open-static',
  )
})

test('public dependency generations remain pinned and usable when their active head changes', async (t) => {
  const f = await fixture(t)
  const first = await f.publish('texture-resources', {
    'index.json': {},
    'trim.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  })
  await f.publish(
    'objects',
    { 'index.json': { texture: first.files['trim.png'].url } },
    undefined,
    [first.files['trim.png']],
  )
  await f.publish('texture-resources', {
    'index.json': {},
    'trim.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
  })
  const manifest = await f.build(),
    index = JSON.parse(
      await fs.readFile(
        path.join(
          f.output,
          manifest.projections.objects.files['index.json'].url,
        ),
      ),
    )
  assert(manifest.dependencies.some((value) => value.generationId === first.id))
  const preserved = await fs.readFile(path.join(f.output, index.texture))
  assert.equal(hash(preserved), first.files['trim.png'].sha256)
  assert.notEqual(
    index.texture,
    manifest.projections['texture-resources'].files['trim.png'].url,
  )
})

test('static build refuses heads replaced after page rendering began', async (t) => {
  const f = await fixture(t),
    first = await f.publish('map', { 'catalog.json': { before: true } })
  await f.build()
  const before = await fs.readFile(
    path.join(f.output, 'workspace-snapshot/manifest.json'),
  )
  await f.publish('map', { 'catalog.json': { after: true } })
  await assert.rejects(
    f.build({
      expectedHeads: {
        map: first.id,
        objects: null,
        'texture-resources': null,
      },
    }),
    /projections changed/,
  )
  assert.deepEqual(
    await fs.readFile(path.join(f.output, 'workspace-snapshot/manifest.json')),
    before,
  )
})
