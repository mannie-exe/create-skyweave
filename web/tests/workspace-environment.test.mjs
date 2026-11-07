import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  createEnvironmentResolver,
  environmentDefinitions,
} from '../scripts/workspace/environment.ts'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { hash } from '../scripts/workspace/identity.ts'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-environment-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: root,
    pack: root,
  }
  for (const folder of [
    'profiles',
    'data/generated/runtime',
    'authoring',
    'overrides/client',
    'tools/resource-exporter',
    '.cache/resource-exporter',
    '.cache/resource-inputs',
    'bin',
    'scripts',
  ])
    await fs.mkdir(path.join(root, folder), { recursive: true })
  await fs.copyFile(
    'profiles/minecraft-1.21.1-neoforge.json',
    path.join(root, 'profiles/minecraft-1.21.1-neoforge.json'),
  )
  const lock = {
    runtime: {
      minecraft: '1.21.1',
      loader: 'neoforge',
      'loader-version': '21.1.264',
    },
    dependencies: {
      'create-confectionery': {
        selection: { selection: { id: 'selected' } },
        files: [{ expected: { digests: { sha512: 'a'.repeat(128) } } }],
      },
    },
  }
  const write = async (relative, value) =>
    fs.writeFile(
      path.join(root, relative),
      typeof value === 'string' ? value : JSON.stringify(value),
    )
  await write('empack.lock', lock)
  await write('empack.yml', {
    runtime: {
      minecraft: '1.21.1',
      loader: { kind: 'neoforge', pin: '21.1.264' },
    },
  })
  await write(
    'overrides/client/options.txt',
    'resourcePacks:["vanilla","file/a.zip","file/b.zip"]\n',
  )
  await write('authoring/visual-patches.json', {
    sources: {
      minecraft: {
        version: '1.21.1',
        sha512: 'b'.repeat(128),
        path: '/private/example',
        url: 'https://example.invalid/private',
      },
    },
  })
  await write('authoring/resource-objects.json', { entities: [] })
  await write('data/local.example.json', {
    server: 'private/server',
    java: 'bin',
    vanilla: 'private/client.jar',
  })
  await write(
    'tools/resource-exporter/StaticModels.java',
    'native factory fixture',
  )
  await write('scripts/export-models.py', 'exporter fixture')
  await write(
    '.cache/resource-inputs/mapped-client.jar',
    'read-only test input',
  )
  for (const name of ['java', 'javac']) {
    await write('bin/' + name, 'unused')
    await fs.chmod(path.join(root, 'bin', name), 0o755)
  }
  await write('.cache/resource-exporter/inputs.json', {
    sourceSha256: hash('native factory fixture'),
    exporterSha256: hash('exporter fixture'),
    minecraft: '1.21.1',
    loader: '21.1.264',
    mappedClientSha256: hash('read-only test input'),
    cemInputSha256: hash('{}'),
    optionalInputs: { 'create-confectionery': hash('optional') },
  })
  const resolver = createEnvironmentResolver([registration], { searchPath: '' })
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return {
    root,
    registration,
    resolver,
    write,
    lock,
    read: async () => (await resolver.resolve(registration)).manifest,
  }
}

test('environment separates portable declared facts, observed capture identity and private tool paths', async (t) => {
  const f = await fixture(t),
    first = await f.read()
  assert.equal(first.selected.intentMatchesLock, true)
  assert.equal(first.observed, null)
  assert.equal(first.resources.packFormat, 34)
  assert.ok(!JSON.stringify(first).includes(f.root))
  assert.ok(!JSON.stringify(first).includes('example.invalid'))
  const python = path.join(f.root, '.cache/python/bin/python')
  await fs.mkdir(path.dirname(python), { recursive: true })
  await fs.symlink(process.execPath, python)
  assert.equal(
    (await f.resolver.resolve(f.registration)).trusted.executables.python,
    python,
  )
  const selectedHash = first.selected.lockSha256
  await f.write('data/generated/runtime/snapshot.json', {
    mods: { 'a.jar': hash('a') },
    lockSha256: selectedHash,
  })
  await f.write('data/generated/runtime/complete.json', {
    minecraft: '1.21.1',
    time: '2026-11-02T00:00:00Z',
  })
  const captured = await f.read()
  assert.equal(captured.observed.currentLock, true)
  await f.write('data/generated/runtime/complete.json', {
    minecraft: '1.21.1',
    time: '2026-11-02T01:00:00Z',
  })
  assert.equal(
    (await f.read()).revision,
    captured.revision,
    'capture timestamp alone must not change semantic identity',
  )
  await f.write('data/local.json', { java: path.join(f.root, 'bin') })
  assert.equal(
    (await f.read()).revision,
    captured.revision,
    'equivalent absolute/relative local paths must not change identity',
  )
  await f.write(
    'overrides/client/options.txt',
    'resourcePacks:["vanilla","file/b.zip","file/a.zip"]\n',
  )
  assert.notEqual(
    (await f.read()).resources.stackRevision,
    first.resources.stackRevision,
  )
  await f.write('data/generated/runtime/complete.json', {
    minecraft: '1.21.2',
    time: '2026-11-02T01:00:00Z',
  })
  const mismatched = await f.read()
  assert.equal(mismatched.observed.minecraft, '1.21.2')
  assert.equal(
    mismatched.capabilities.find((cap) => cap.id === 'runtime').state,
    'stale',
  )
})

test('an unavailable active native projection cannot fall through to legacy metadata', async (t) => {
  const f = await fixture(t),
    actor = {
      principal: { kind: 'anonymous', id: 'local-open' },
      connectionId: randomUUID(),
    }
  await fs.mkdir(path.join(f.root, '.cache/python/bin'), { recursive: true })
  await fs.symlink(
    process.execPath,
    path.join(f.root, '.cache/python/bin/python'),
  )
  let active
  const resolver = createEnvironmentResolver([f.registration], {
    searchPath: '',
    nativeManifest: async () => active,
  })
  const read = async () =>
    (await resolver.resolve(f.registration, actor)).manifest.capabilities.find(
      (cap) => cap.id === 'static-entities',
    )
  const legacy = await read()
  assert.equal(legacy.state, 'supported')
  active = null
  assert.equal((await read()).state, 'stale')
  active = undefined
  assert.equal((await read()).inputRevision, legacy.inputRevision)
})

test('optional dependency removal preserves vanilla adapter identity; stale and unsupported facts are explicit', async (t) => {
  const f = await fixture(t),
    before = await f.read()
  const capability = (manifest, id) =>
    manifest.capabilities.find((cap) => cap.id === id)
  const changed = structuredClone(f.lock)
  delete changed.dependencies['create-confectionery']
  await f.write('empack.lock', changed)
  const after = await f.read()
  assert.equal(capability(after, 'confectionery-static').state, 'unavailable')
  assert.equal(
    capability(before, 'static-entities').inputRevision,
    capability(after, 'static-entities').inputRevision,
  )
  await f.write(
    '.cache/resource-inputs/mapped-client.jar',
    'changed mapped input',
  )
  const remapped = await f.read()
  assert.notEqual(
    capability(remapped, 'static-entities').inputRevision,
    capability(after, 'static-entities').inputRevision,
  )
  await f.write('empack.yml', {
    runtime: {
      minecraft: '1.21.1',
      loader: { kind: 'neoforge', pin: '21.1.265' },
    },
  })
  assert.ok((await f.read()).capabilities.every((cap) => cap.state === 'stale'))
  changed.runtime.minecraft = '1.21.2'
  await f.write('empack.lock', changed)
  assert.ok(
    (await f.read()).capabilities.every((cap) => cap.state === 'unsupported'),
  )
})

test('environment queries are policy checked before reads and reject source symlinks', async (t) => {
  const f = await fixture(t)
  let denied = true
  const service = createWorkspaceService({
    registrations: [f.registration],
    definitions: environmentDefinitions(f.resolver),
    policy: {
      mode: 'restricted',
      decide: (_ctx, action) => ({
        allowed: action !== 'environment.read' || !denied,
      }),
    },
  })
  t.after(() => service.dispose())
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const query = () =>
    service.query(actor, f.registration.scope, 'environment.read', {})
  await assert.rejects(query(), /unavailable|authorized/)
  denied = false
  assert.equal((await query()).scope.packId, 'fixture')
  const file = path.join(f.root, 'empack.lock')
  await fs.rename(file, file + '.original')
  await fs.symlink(file + '.original', file)
  await assert.rejects(query(), /symlinks/)
})

test('loaded adapter identity cannot be reassigned to subsequently edited source', async (t) => {
  const { loadedTool } = await import('../scripts/workspace/loaded-tool.ts')
  const { pathToFileURL } = await import('node:url')
  const f = await fixture(t),
    file = path.join(f.root, 'adapter.ts')
  await fs.writeFile(file, 'original adapter')
  const revision = loadedTool(pathToFileURL(file).href)
  assert.equal(await revision(), hash('original adapter'))
  await fs.writeFile(file, 'edited adapter')
  await assert.rejects(revision(), { code: 'CAPABILITY_UNAVAILABLE' })
})
