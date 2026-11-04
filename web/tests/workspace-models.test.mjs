import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'
import { modelDefinitions } from '../scripts/workspace/models.ts'

test('model queries stay pure, validation protects source, and checked resource output replaces only the expected file', async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-models-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: root,
    pack: root,
  }
  await fs.mkdir(path.join(root, 'authoring/resource-licenses'), {
    recursive: true,
  })
  await fs.cp(path.resolve('../scripts'), path.join(root, 'scripts'), {
    recursive: true,
    filter: (file) => !file.includes('__pycache__'),
  })
  for (const [name, value] of Object.entries({
    'model-recipes': { schema: 1, recipes: [] },
    'resource-patches': { schema: 1, sources: {} },
    'resource-selections': { schema: 1, selections: [] },
    'texture-resources': { schema: 1, resources: [] },
  }))
    await fs.writeFile(
      path.join(root, 'authoring', name + '.json'),
      JSON.stringify(value),
    )
  for (const name of ['empack.yml', 'empack.lock', 'empack.bindings.yml'])
    await fs.copyFile(path.resolve('..', name), path.join(root, name))
  await fs.writeFile(
    path.join(root, 'authoring/resource-licenses/nautilus3d-AGPL-3.0.txt'),
    'Fixture license',
  )
  // Only the producer is a fixture; native model validation and ZIP verification
  // use maintained scripts. It never borrows or rewrites the playable pack.
  const producer = path.join(root, 'scripts/fixture-build.py')
  await fs.writeFile(
    producer,
    `import json,sys,zipfile\nfrom pathlib import Path\np=Path(sys.argv[sys.argv.index('--output')+1])\nwith zipfile.ZipFile(p,'w') as z:\n z.writestr('pack.mcmeta',json.dumps({'pack':{'pack_format':34,'description':'fixture'}}))\n z.writestr('assets/fixture/test.txt','built')\n`,
  )
  const runner = createJobRunner({
    ...jobRegistry,
    'resources.generate': {
      ...jobRegistry['resources.generate'],
      script: 'fixture-build.py',
    },
  })
  let service,
    executions = 0
  runner.subscribe((snapshot) => {
    if (snapshot.current?.state === 'running' && !snapshot.current.diagnostic)
      executions++
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
    definitions: modelDefinitions([registration], native, artifacts),
    shutdown: () => native.dispose(),
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const read = () => service.query(actor, registration.scope, 'models.read', {})
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
  const before = await read()
  assert.equal(executions, 0)
  const preview = await command('models.preview', { document: before.document })
  assert.equal(preview.operation.state, 'succeeded', preview.error?.message)
  assert.equal((await read()).preview.state, 'current')
  const count = executions
  await read()
  assert.equal(executions, count)
  const invalid = await command('models.save', {
    document: { schema: 99, recipes: [] },
    revision: before.revision,
  })
  assert.equal(invalid.operation.state, 'failed')
  assert.deepEqual((await read()).document, before.document)
  const document = { ...before.document, description: 'Fixture model' }
  const saved = await command('models.save', {
    document,
    revision: before.revision,
  })
  assert.equal(saved.operation.state, 'succeeded', saved.error?.message)
  const generated = await command('resources.generate', {
    revision: saved.payload.revision,
  })
  assert.equal(generated.operation.state, 'succeeded', generated.error?.message)
  const destination = path.join(
    root,
    'overrides/client/resourcepacks/Create Skyweave Resource Patches.zip',
  )
  const published = await fs.readFile(destination)
  const reference = await artifacts.resolve(
    actor,
    registration.scope,
    generated.payload.artifact.id,
  )
  assert.deepEqual(await fs.readFile(reference.file), published)
  assert.ok(
    generated.operation.stages.some(
      (stage) => stage.name === 'resource-patches',
    ),
  )
  await fs.writeFile(
    producer,
    "import sys\nfrom pathlib import Path\nPath(sys.argv[sys.argv.index('--output')+1]).write_text('broken ZIP')\n",
  )
  const broken = await command('resources.generate', {
    revision: saved.payload.revision,
  })
  assert.equal(broken.operation.state, 'failed')
  assert.deepEqual(await fs.readFile(destination), published)
  assert.equal(
    (await artifacts.active(actor, registration.scope, 'resource-build')).id,
    generated.payload.artifact.generationId,
  )
  assert.deepEqual(
    await fs.readdir(path.join(root, '.cache/workspace/staging')),
    [],
  )
  const pins = path.join(root, 'authoring/resource-patches.json')
  await fs.writeFile(path.join(root, 'asset.zip'), 'changed resource')
  await fs.writeFile(
    pins,
    JSON.stringify({
      schema: 1,
      sources: { candidate: { path: 'asset.zip', sha512: '0'.repeat(128) } },
    }),
  )
  const oldCount = executions
  await assert.rejects(
    command('models.preview', { document }),
    (error) => error.code === 'CAPABILITY_UNAVAILABLE',
  )
  assert.equal(executions, oldCount)
})
