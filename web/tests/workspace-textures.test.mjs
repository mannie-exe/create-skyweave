import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'
import { createEnvironmentResolver } from '../scripts/workspace/environment.ts'
import { textureDefinitions } from '../scripts/workspace/textures.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-textures-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: root,
    pack: root,
  }
  for (const folder of [
    'authoring',
    'profiles',
    'data',
    'overrides/client/resourcepacks',
  ])
    await fs.mkdir(path.join(root, folder), { recursive: true })
  await fs.cp(path.resolve('../scripts'), path.join(root, 'scripts'), {
    recursive: true,
    filter: (file) => !file.includes('__pycache__'),
  })
  await fs.copyFile(
    'profiles/minecraft-1.21.1-neoforge.json',
    path.join(root, 'profiles/minecraft-1.21.1-neoforge.json'),
  )
  for (const [name, value] of Object.entries({
    'model-recipes': { schema: 1, recipes: [] },
    'visual-patches': { schema: 1, sources: {} },
    'resource-selections': { schema: 1, selections: [] },
    'texture-resources': {
      schema: 1,
      resources: [{ inputs: ['minecraft:block/test'] }],
    },
  }))
    await fs.writeFile(
      path.join(root, 'authoring', name + '.json'),
      JSON.stringify(value),
    )
  await fs.writeFile(
    path.join(root, 'empack.yml'),
    JSON.stringify({
      runtime: {
        minecraft: '1.21.1',
        loader: { kind: 'neoforge', pin: '21.1.264' },
      },
    }),
  )
  await fs.writeFile(
    path.join(root, 'empack.lock'),
    JSON.stringify({
      runtime: {
        minecraft: '1.21.1',
        loader: 'neoforge',
        'loader-version': '21.1.264',
      },
      dependencies: {},
    }),
  )
  await fs.writeFile(path.join(root, 'empack.bindings.yml'), 'schema: 1\n')
  await fs.writeFile(path.join(root, 'data/local.example.json'), '{}')
  const patch = path.join(
    root,
    'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
  )
  await fs.writeFile(patch, 'unchanged fixture shipping output')
  // Real admission, source identity and artifact publication; only the PNG/index producer
  // is a disposable fixture. The maintained producer is exercised separately on real inputs.
  await fs.writeFile(
    path.join(root, 'scripts/fixture-textures.py'),
    `import base64,json,sys\nfrom pathlib import Path\nout=Path(sys.argv[sys.argv.index('--output')+1])\nmode=Path('fixture-mode').read_text() if Path('fixture-mode').exists() else 'good'\n(out/'texture.png').write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1kAAAAASUVORK5CYII='))\n(out/'index.json').write_text(json.dumps({'schema':1,'resources':[],'image':'/generated/texture-resources/'+('missing.png' if mode=='missing' else 'texture.png')}))\n`,
  )
  let service,
    denied = false,
    starts = 0
  const runner = createJobRunner({
    ...jobRegistry,
    'textures.generate': {
      ...jobRegistry['textures.generate'],
      script: 'fixture-textures.py',
    },
  })
  runner.subscribe((snapshot) => {
    if (
      snapshot.current?.name === 'textures.generate' &&
      snapshot.current.state === 'running'
    )
      starts++
  })
  const native = createNativeExecutor({
    runner,
    session: () => service.session,
  })
  const environments = createEnvironmentResolver([registration])
  const artifacts = createArtifactStore({
    root: path.join(root, '.cache/artifacts'),
    registrations: [registration],
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: textureDefinitions(
      [registration],
      native,
      artifacts,
      environments,
    ),
    shutdown: () => native.dispose(),
    policy: {
      mode: 'restricted',
      decide: (_ctx, action, target) => ({
        allowed:
          !denied ||
          action !== 'source.read' ||
          target.id !== 'skyweave-resource-patches:minecraft:block/test',
      }),
    },
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const command = async (payload) =>
    (
      await service.submit(actor, {
        v: 1,
        type: 'command',
        requestId: randomUUID(),
        commandId: randomUUID(),
        session: service.session,
        createdAt: new Date().toISOString(),
        scope: registration.scope,
        operation: 'textures.generate',
        payload,
      })
    ).outcome
  return {
    root,
    registration,
    native,
    artifacts,
    actor,
    command,
    patch,
    starts: () => starts,
    deny: () => {
      denied = true
    },
  }
}

test('texture publication is coherent; missing artifacts and concurrent source changes keep the displayed generation', async (t) => {
  const f = await fixture(t),
    first = await f.command({})
  assert.equal(first.operation.state, 'succeeded', first.error?.message)
  const generation = await f.artifacts.active(
    f.actor,
    f.registration.scope,
    'texture-resources',
  )
  const resolved = await f.artifacts.resolve(
    f.actor,
    f.registration.scope,
    first.payload.artifact.id,
  )
  const index = JSON.parse(await fs.readFile(resolved.file, 'utf8'))
  assert.equal(index.image, generation.files['texture.png'].url)
  assert.equal(index.environment.profile, 'minecraft-1.21.1-neoforge')
  assert.equal(
    index.environment.inputRevision,
    first.payload.artifact.inputRevision,
  )
  await fs.writeFile(path.join(f.root, 'fixture-mode'), 'missing')
  const failed = await f.command({})
  assert.equal(failed.error.code, 'GENERATION_FAILED')
  assert.equal(
    (
      await f.artifacts.active(
        f.actor,
        f.registration.scope,
        'texture-resources',
      )
    ).id,
    generation.id,
  )
  await fs.writeFile(path.join(f.root, 'fixture-mode'), 'good')
  let changed = false
  const off = f.native.runner.subscribe((snapshot) => {
    if (!changed && snapshot.current?.name === 'textures.generate') {
      changed = true
      appendFileSync(
        path.join(f.root, 'authoring/resource-selections.json'),
        '\n',
      )
    }
  })
  const stale = await f.command({})
  off()
  assert.equal(stale.error.code, 'REVISION_CONFLICT')
  assert.equal(
    (
      await f.artifacts.active(
        f.actor,
        f.registration.scope,
        'texture-resources',
      )
    ).id,
    generation.id,
  )
  assert.equal(
    await fs.readFile(f.patch, 'utf8'),
    'unchanged fixture shipping output',
  )
  assert.deepEqual(
    await fs.readdir(path.join(f.root, '.cache/workspace/staging')),
    [],
  )
  await assert.rejects(fs.stat(path.join(f.root, 'web/public/generated')), {
    code: 'ENOENT',
  })
  const count = f.starts()
  await assert.rejects(
    f.command({ path: '/tmp/unwanted' }),
    /Invalid operation input/,
  )
  assert.equal(f.starts(), count)
  f.deny()
  await assert.rejects(f.command({}), /unavailable|authorized/)
  assert.equal(f.starts(), count)
})
