import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { domainFixture } from './domain-fixture.mjs'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-authoring-')),
  )
  await fs.cp(
    path.resolve('../authoring/journal'),
    path.join(root, 'authoring/journal'),
    { recursive: true },
  )
  await fs.mkdir(path.join(root, 'authoring/changes'))
  await fs.mkdir(path.join(root, 'scripts'))
  for (const name of ['generate-journal.py', 'audit-changes.py'])
    await fs.copyFile(
      path.resolve('../scripts', name),
      path.join(root, 'scripts', name),
    )
  return {
    root,
    editor: domainFixture(t, root, 'journal'),
    name: 'journal/locales/en_us.json',
  }
}

test('save validates real journal source without generating; generation checks source revision', async (t) => {
  const { root, editor, name } = await fixture(t),
    before = await editor.read(),
    text = before.files[name].text + '\n'
  const destination = path.join(
    root,
    'overrides/common/config/questlog/quests/travel/glider.json',
  )
  await editor.save({ name, revision: before.files[name].revision, text })
  assert.equal(
    await fs.readFile(path.join(root, 'authoring', name), 'utf8'),
    text,
  )
  await assert.rejects(fs.access(destination), { code: 'ENOENT' })
  await assert.rejects(
    editor.generate({ revision: before.revision }),
    (error) => error.code === 'REVISION_CONFLICT',
  )
  await editor.generate({ revision: (await editor.read()).revision })
  assert.equal(
    JSON.parse(await fs.readFile(destination, 'utf8')).title,
    'create_skyweave.journal.travel.glider.title',
  )
})

test('stale save, malformed JSON and failed native validation leave disk unchanged', async (t) => {
  const { root, editor, name } = await fixture(t),
    before = await editor.read(),
    revision = before.files[name].revision
  await assert.rejects(
    editor.save({ name, revision: '0'.repeat(64), text: '{}' }),
    (error) => error.code === 'REVISION_CONFLICT',
  )
  await assert.rejects(
    editor.save({ name, revision, text: '{' }),
    (error) => error.code === 'INVALID_INPUT',
  )
  await assert.rejects(
    editor.save({
      name,
      revision,
      text: JSON.stringify({
        ...JSON.parse(before.files[name].text),
        schema: 99,
      }),
    }),
    (error) => error.code === 'GENERATION_FAILED',
  )
  assert.equal(
    await fs.readFile(path.join(root, 'authoring', name), 'utf8'),
    before.files[name].text,
  )
})

test('arbitrary paths and source symlinks are rejected by the shared service', async (t) => {
  const { root, editor, name } = await fixture(t)
  for (const invalid of [
    '../../secret',
    'journal/locales/../defaults.json',
    '/etc/passwd',
    'changes/new.txt',
  ])
    await assert.rejects(
      editor.save({ name: invalid, text: '{}', revision: '0'.repeat(64) }),
      (error) => error.code === 'INVALID_INPUT',
    )
  const target = path.join(root, 'authoring', name)
  await fs.rename(target, path.join(root, 'outside.json'))
  await fs.symlink(path.join(root, 'outside.json'), target)
  await assert.rejects(editor.read(), /symlink/i)
})
