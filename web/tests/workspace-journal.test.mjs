import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import { journalDefinitions } from '../scripts/workspace/journal.ts'

const actor = {
  principal: { kind: 'anonymous', id: 'local-open' },
  connectionId: randomUUID(),
}
async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-journal-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: root,
    pack: root,
  }
  await fs.cp(
    path.resolve('../authoring/journal'),
    path.join(root, 'authoring/journal'),
    { recursive: true },
  )
  await fs.mkdir(path.join(root, 'authoring/changes'))
  await fs.mkdir(path.join(root, 'scripts'))
  for (const script of ['generate-journal.py', 'audit-changes.py'])
    await fs.copyFile(
      path.resolve('../scripts', script),
      path.join(root, 'scripts', script),
    )
  let service,
    denied = false,
    jobs = 0
  const native = createNativeExecutor({ session: () => service.session })
  native.runner.subscribe((snapshot) => {
    if (snapshot.current?.state === 'running' && !snapshot.current.diagnostic)
      jobs++
  })
  const artifacts = createArtifactStore({
    root: path.join(root, '.cache/artifacts'),
    registrations: [registration],
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: journalDefinitions([registration], native, artifacts),
    policy: {
      mode: 'restricted',
      decide: (_ctx, action, resource) => ({
        allowed:
          !denied ||
          action !== 'source.read' ||
          resource.id !== 'journal/locales/en_us.json',
      }),
    },
    shutdown: () => native.dispose(),
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  const read = () =>
    service.query(actor, registration.scope, 'journal.read', {})
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
    root,
    service,
    native,
    artifacts,
    registration,
    read,
    command,
    jobCount: () => jobs,
    deny: () => {
      denied = true
    },
  }
}

test('journal queries are pure; staged validation and generation use exact revisions and publish native output', async (t) => {
  const f = await fixture(t),
    before = await f.read()
  assert.equal(f.jobCount(), 0)
  assert.equal(before.preview.state, 'unavailable')
  const preview = await f.command('journal.preview', {
    revision: before.revision,
  })
  assert.equal(preview.operation.state, 'succeeded')
  const resolved = await f.artifacts.resolve(
    actor,
    f.registration.scope,
    preview.payload.id,
  )
  const diff = JSON.parse(await fs.readFile(resolved.file, 'utf8'))
  assert.ok(diff.outputs > 70)
  assert.ok(diff.changed.includes('empack.bindings.yml'))
  assert.equal((await f.read()).preview.state, 'current')
  const afterPreview = f.jobCount()
  await f.read()
  assert.equal(f.jobCount(), afterPreview)
  await assert.rejects(
    fs.stat(path.join(f.root, 'overrides/common/config/questlog')),
    { code: 'ENOENT' },
  )
  const generated = await f.command('journal.generate', {
    revision: before.revision,
  })
  assert.equal(generated.operation.state, 'succeeded', generated.error?.message)
  assert.ok(
    generated.operation.stages.some(
      (stage) => stage.name === 'journal-output' && stage.committed,
    ),
  )
  assert.equal((await f.read()).preview.state, 'current')
  const english = JSON.parse(before.files['journal/locales/en_us.json'].text)
  english.entries['travel/glider'].title = 'Fixture glider'
  const saved = await f.command('journal.save', {
    revision: before.revision,
    changes: { 'journal/locales/en_us.json': JSON.stringify(english) },
  })
  assert.equal(saved.operation.state, 'succeeded', saved.error?.message)
  const loaded = await f.read()
  assert.notEqual(loaded.revision, before.revision)
  assert.equal(loaded.preview.state, 'stale')
  const localeFile = path.join(
    f.root,
    'pack-fixes/assets/create_skyweave/lang/en_us.json',
  )
  assert.ok(!(await fs.readFile(localeFile, 'utf8')).includes('Fixture glider'))
  const invalid = await f.command('journal.save', {
    revision: loaded.revision,
    changes: { 'journal/locales/en_us.json': '{"schema":999}' },
  })
  assert.equal(invalid.operation.state, 'failed')
  assert.equal(
    (await f.read()).files['journal/locales/en_us.json'].text,
    JSON.stringify(english),
  )
  const stale = await f.command('journal.generate', {
    revision: before.revision,
  })
  assert.equal(stale.error.code, 'REVISION_CONFLICT')
  const final = await f.command('journal.generate', {
    revision: loaded.revision,
  })
  assert.equal(final.operation.state, 'succeeded', final.error?.message)
  assert.match(await fs.readFile(localeFile, 'utf8'), /Fixture glider/)
  assert.deepEqual(
    await fs.readdir(path.join(f.root, '.cache/workspace/staging')),
    [],
  )
  assert.deepEqual(
    await fs.readdir(
      path.join(f.root, '.cache/workspace/local/fixture/processes'),
    ),
    [],
  )
})

test('denied journal dependencies are filtered on read and prevent validation or generation', async (t) => {
  const f = await fixture(t),
    before = await f.read()
  f.deny()
  const visible = await f.read()
  assert.equal(visible.files['journal/locales/en_us.json'], undefined)
  assert.equal(
    Object.keys(visible.files).length,
    Object.keys(before.files).length - 1,
  )
  await assert.rejects(
    f.command('journal.preview', { revision: visible.revision }),
    (error) => error.code === 'NOT_FOUND',
  )
  await assert.rejects(
    f.command('journal.save', {
      revision: visible.revision,
      changes: { 'journal/locales/en_us.json': '{}' },
    }),
    (error) => error.code === 'NOT_FOUND',
  )
  assert.equal(f.jobCount(), 0)
})

test('configuration source saves record their own result without claiming journal generation', async (t) => {
  const f = await fixture(t)
  const source = path.join(f.root, 'authoring/changes/client.json')
  await fs.writeFile(source, JSON.stringify({ schema: 1, records: [] }))
  const before = await f.read()
  const result = await f.command('config.source.save', {
    revision: before.revision,
    changes: {
      'changes/client.json': JSON.stringify(
        { schema: 1, records: [] },
        null,
        2,
      ),
    },
  })
  assert.equal(result.operation.state, 'succeeded', result.error?.message)
  assert.equal(result.operation.label, 'Save configuration source')
  assert.equal(result.operation.message, 'Source saved.')
  const activity = await f.service.activity(actor, f.registration.scope)
  const id = activity.history[0].id
  activity.history[0].message = 'tampered'
  assert.equal(
    (await f.service.activity(actor, f.registration.scope)).history[0].message,
    'Source saved.',
  )
  await f.read()
  assert.equal(
    (await f.service.activity(actor, f.registration.scope)).history[0].id,
    id,
  )
})
