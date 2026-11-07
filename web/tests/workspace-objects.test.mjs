import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID, createHash } from 'node:crypto'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'
import { createEnvironmentResolver } from '../scripts/workspace/environment.ts'
import { objectDefinitions } from '../scripts/workspace/objects.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'

test('registered object previews use admitted dependencies, reject stale stacks and preserve prior generations', async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-objects-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: root,
    pack: root,
  }
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  for (const folder of [
    'authoring',
    'profiles',
    'data/generated/runtime',
    'tools/resource-exporter',
    '.cache/resource-inputs',
    'overrides/client/resourcepacks',
  ])
    await fs.mkdir(path.join(root, folder), { recursive: true })
  await fs.cp(path.resolve('../scripts'), path.join(root, 'scripts'), {
    recursive: true,
    filter: (file) => !file.includes('__pycache__'),
  })
  for (const file of [
    'scripts/paths.py',
    'scripts/resource-inputs.mjs',
    'scripts/export-models.py',
    'tools/resource-exporter/StaticModels.java',
    'pnpm-lock.yaml',
    'profiles/minecraft-1.21.1-neoforge.json',
  ])
    await fs.copyFile(file, path.join(root, file))
  async function write(file, value) {
    await fs.writeFile(
      path.join(root, file),
      typeof value === 'string' ? value : JSON.stringify(value),
    )
  }
  const vanilla = 'fixture vanilla resource input'
  await write('.cache/resource-inputs/client.jar', vanilla)
  for (const [name, value] of Object.entries({
    'model-recipes': { schema: 1, recipes: [] },
    'resource-selections': { schema: 1, selections: [] },
    'texture-resources': { schema: 1, resources: [] },
    'resource-objects': { schema: 1, candidates: [] },
    'visual-patches': {
      schema: 1,
      sources: {
        minecraft: {
          path: '.cache/resource-inputs/client.jar',
          sha512: createHash('sha512').update(vanilla).digest('hex'),
        },
      },
    },
  }))
    await write('authoring/' + name + '.json', value)
  await write('empack.yml', {
    runtime: {
      minecraft: '1.21.1',
      loader: { kind: 'neoforge', pin: '21.1.264' },
    },
  })
  await write('empack.lock', {
    runtime: {
      minecraft: '1.21.1',
      loader: 'neoforge',
      'loader-version': '21.1.264',
    },
    dependencies: {},
  })
  await write('empack.bindings.yml', 'schema: 1\n')
  await write('overrides/client/options.txt', 'resourcePacks:["vanilla"]\n')
  await write('data/local.example.json', {})
  for (const name of ['blocks', 'entities'])
    await write('data/generated/runtime/' + name + '.json', [])
  await write(
    'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
    'unchanged shipping fixture',
  )
  // Only the renderer is a fixture. Admission, hashes, dependency staging and publication
  // are maintained code; the actual renderer/static factory also have native/browser checks.
  await write(
    'scripts/fixture-objects.py',
    `import base64,json,sys\nfrom pathlib import Path\na=sys.argv\nout=Path(a[a.index('--output')+1])\nassert Path(a[a.index('--texture-index')+1]).is_file()\nassert (Path(a[a.index('--native-inputs')+1])/'inputs.json').is_file()\nmode=Path('fixture-mode').read_text() if Path('fixture-mode').exists() else 'good'\n(out/'test.png').write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1kAAAAASUVORK5CYII='))\nimage='/generated/objects/'+('missing.png' if mode=='missing' else 'test.png')\nvalue={'preview':{'meshes':[]},'evidence':[],'image':image} if '--stdin' in a else {'schema':1,'objects':[{'id':'block/minecraft:stone','cases':[{'id':'normal'}]}],'layers':[{'id':'vanilla'}],'image':image}\nif '--stdin' in a: json.load(sys.stdin)\n(out/('preview.json' if '--stdin' in a else 'index.json')).write_text(json.dumps(value))\n`,
  )
  let service,
    denied = '',
    starts = 0
  const runner = createJobRunner({
    ...jobRegistry,
    'objects.generate': {
      ...jobRegistry['objects.generate'],
      script: 'fixture-objects.py',
    },
    'objects.preview': {
      ...jobRegistry['objects.preview'],
      script: 'fixture-objects.py',
    },
  })
  runner.subscribe((snapshot) => {
    if (snapshot.current?.state === 'running' && !snapshot.current.diagnostic)
      starts++
  })
  const native = createNativeExecutor({
    runner,
    session: () => service.session,
  })
  const artifacts = createArtifactStore({
    root: path.join(root, '.cache/artifacts'),
    registrations: [registration],
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: objectDefinitions(
      [registration],
      native,
      artifacts,
      createEnvironmentResolver([registration]),
    ),
    policy: {
      mode: 'restricted',
      decide: (_ctx, _action, target) => ({
        allowed:
          target.id !== denied &&
          !['native:cache', 'native:loader-libraries'].includes(target.id),
      }),
    },
    shutdown: () => native.dispose(),
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  const seed = path.join(root, 'seed')
  await fs.mkdir(seed)
  async function publish(namespace, files) {
    for (const [name, value] of Object.entries(files))
      await fs.writeFile(path.join(seed, name), JSON.stringify(value))
    return artifacts.publish(
      {
        ...actor,
        registration,
        scope: registration.scope,
        inputRevisions: {},
        authorize: async () => {},
        committed() {},
        invalidate() {},
      },
      {
        namespace,
        staging: seed,
        files: Object.fromEntries(
          Object.keys(files).map((name) => [name, path.join(seed, name)]),
        ),
        inputs: {},
        recheck: async () => {},
      },
    )
  }
  const texture = await publish('texture-resources', {
    'index.json': { schema: 1, resources: [] },
  })
  const exported = await publish('native-models', {
    'inputs.json': {},
    'native-models.json': { schema: 1, models: {} },
    'cem-inputs.json': {},
  })
  const command = async (operation, payload = {}) =>
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
  const first = await command('objects.generate')
  assert.equal(first.operation.state, 'succeeded', first.error?.message)
  const current = await artifacts.active(actor, registration.scope, 'objects')
  assert.deepEqual(
    new Set(current.dependencies.map((entry) => entry.generationId)),
    new Set([texture.id, exported.id]),
  )
  const index = JSON.parse(
    await fs.readFile(
      (
        await artifacts.resolve(
          actor,
          registration.scope,
          first.payload.artifact.id,
        )
      ).file,
      'utf8',
    ),
  )
  assert.equal(index.image, current.files['test.png'].url)
  const draft = {
    object: 'block/minecraft:stone',
    case: 'normal',
    layers: ['vanilla'],
  }
  const preview = await command('objects.preview', draft)
  assert.equal(preview.operation.state, 'succeeded', preview.error?.message)
  const beforeInvalid = starts
  for (const invalid of [
    { ...draft, object: 'block/minecraft:unknown' },
    { ...draft, layers: ['vanilla', 'vanilla'] },
    { ...draft, path: '/tmp/elsewhere' },
  ])
    await assert.rejects(command('objects.preview', invalid), {
      code: 'INVALID_INPUT',
    })
  assert.equal(starts, beforeInvalid)
  await write('fixture-mode', 'missing')
  assert.equal(
    (await command('objects.generate')).error.code,
    'GENERATION_FAILED',
  )
  assert.equal(
    (await artifacts.active(actor, registration.scope, 'objects')).id,
    current.id,
  )
  await write('fixture-mode', 'good')
  let changed = false
  const off = runner.subscribe((snapshot) => {
    if (!changed && snapshot.current?.name === 'objects.generate') {
      changed = true
      appendFileSync(
        path.join(root, 'authoring/resource-selections.json'),
        '\n',
      )
    }
  })
  assert.equal(
    (await command('objects.generate')).error.code,
    'REVISION_CONFLICT',
  )
  off()
  assert.equal(
    (await artifacts.active(actor, registration.scope, 'objects')).id,
    current.id,
  )
  await assert.rejects(command('objects.preview', draft), {
    code: 'REVISION_CONFLICT',
  })
  const beforeDenied = starts
  denied = exported.files['inputs.json'].id
  await assert.rejects(command('objects.generate'), { code: 'NOT_FOUND' })
  assert.equal(starts, beforeDenied)
  assert.equal(
    await fs.readFile(
      path.join(
        root,
        'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
      ),
      'utf8',
    ),
    'unchanged shipping fixture',
  )
  assert.deepEqual(
    await fs.readdir(path.join(root, '.cache/workspace/staging')),
    [],
  )
})
