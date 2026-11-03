import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { domainFixture } from './domain-fixture.mjs'
import {
  createEntry,
  removeEntry,
  updateDefinition,
  localeText,
  localePath,
  encode,
} from '../src/lib/journal.mjs'
const pack = fileURLToPath(new URL('../../', import.meta.url))
async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-journal-crud-')),
  )
  await fs.cp(path.join(pack, 'authoring'), path.join(root, 'authoring'), {
    recursive: true,
  })
  await fs.mkdir(path.join(root, 'scripts'))
  for (const name of ['generate-journal.py', 'audit-changes.py'])
    await fs.copyFile(
      path.join(pack, 'scripts', name),
      path.join(root, 'scripts', name),
    )
  const editor = domainFixture(t, root, 'journal'),
    snapshot = await editor.read()
  return {
    root,
    editor,
    snapshot,
    documents: Object.fromEntries(
      Object.entries(snapshot.files).map(([name, file]) => [
        name,
        JSON.parse(file.text),
      ]),
    ),
  }
}
const diff = (snapshot, documents) =>
  Object.fromEntries(
    Object.entries(documents)
      .filter(
        ([name, value]) =>
          !snapshot.files[name] ||
          JSON.stringify(value) !==
            JSON.stringify(JSON.parse(snapshot.files[name].text)),
      )
      .map(([name, value]) => [name, encode(value)]),
  )
test('entry CRUD, sparse locales and native generation share one source contract', async (t) => {
  const { root, editor, snapshot, documents } = await fixture(t)
  let docs = createEntry(
    documents,
    'travel',
    'test_route',
    'Test route',
    'minecraft:iron_ingot',
  )
  docs[localePath('de_de')] = {
    schema: 1,
    entries: { 'travel/test_route': { title: 'Testweg' } },
    chapters: {},
    shared: {},
  }
  const definition = docs['journal/chapters/travel.json'].entries.find(
    (e) => e.id === 'test_route',
  ).definition
  docs = updateDefinition(docs, 'travel/test_route', {
    ...definition,
    rewards: [
      {
        type: 'questlog:choice',
        choices: [
          { type: 'questlog:item', item: 'minecraft:iron_ingot', count: 2 },
        ],
      },
    ],
  })
  assert.equal(
    localeText(docs, 'de_de').entries['travel/test_route'].requirements,
    'Have at least 1 Test route in your inventory at once.',
  )
  await editor.save({
    revision: snapshot.revision,
    changes: diff(snapshot, docs),
  })
  let saved = await editor.read()
  await assert.rejects(
    fs.stat(
      path.join(
        root,
        'overrides/common/config/questlog/quests/travel/test_route.json',
      ),
    ),
    { code: 'ENOENT' },
  )
  await editor.generate({ revision: saved.revision })
  const read = async (rel) =>
    JSON.parse(await fs.readFile(path.join(root, rel), 'utf8'))
  const native = await read(
    'overrides/common/config/questlog/quests/travel/test_route.json',
  )
  assert.equal(native.title, 'createsky.journal.travel.test_route.title')
  assert.equal(native.rewards[0].choices[0].count, 2)
  const de = await read('pack-fixes/assets/createsky/lang/de_de.json')
  assert.equal(de[native.title], 'Testweg')
  assert.equal(
    de[native.description.translate],
    localeText(docs, 'de_de').entries['travel/test_route'].requirements,
  )
  saved = await editor.read()
  docs = removeEntry(docs, 'travel/test_route')
  assert.equal(
    docs[localePath('de_de')].entries['travel/test_route'],
    undefined,
  )
  await editor.save({ revision: saved.revision, changes: diff(saved, docs) })
  saved = await editor.read()
  assert.ok(
    (
      await editor.artifactJSON(await editor.preview(saved.revision))
    ).removed.includes(
      'overrides/common/config/questlog/quests/travel/test_route.json',
    ),
  )
  await editor.generate({ revision: saved.revision })
  await assert.rejects(
    fs.stat(
      path.join(
        root,
        'overrides/common/config/questlog/quests/travel/test_route.json',
      ),
    ),
    { code: 'ENOENT' },
  )
  assert.equal(
    (await read('pack-fixes/assets/createsky/lang/de_de.json'))[native.title],
    undefined,
  )
  // A foreign native quest is not ours to delete.
  const foreign = path.join(
    root,
    'overrides/common/config/questlog/quests/foreign.json',
  )
  await fs.writeFile(
    foreign,
    JSON.stringify({ title: 'Another author', objectives: [] }),
  )
  await editor.generate({ revision: (await editor.read()).revision })
  assert.equal(
    (await read('overrides/common/config/questlog/quests/foreign.json')).title,
    'Another author',
  )
})
test('invalid coordinated saves, stale revisions and symlinked new locales cannot change source', async (t) => {
  const { root, editor, snapshot, documents } = await fixture(t)
  const docs = createEntry(
    documents,
    'travel',
    'test_route',
    'Test route',
    'minecraft:iron_ingot',
  )
  const incomplete = {
    'journal/chapters/travel.json': encode(
      docs['journal/chapters/travel.json'],
    ),
  }
  await assert.rejects(
    editor.save({ revision: snapshot.revision, changes: incomplete }),
    /locale IDs/,
  )
  assert.equal((await editor.read()).revision, snapshot.revision)
  await assert.rejects(
    editor.save({ revision: '0'.repeat(64), changes: diff(snapshot, docs) }),
    (error) => error.code === 'REVISION_CONFLICT',
  )
  await assert.rejects(
    editor.save({
      revision: snapshot.revision,
      changes: { '../../outside': '{}' },
    }),
    /Unknown authoring/,
  )
  await assert.rejects(
    editor.save({
      revision: snapshot.revision,
      changes: { 'journal/locales/en_us.json': null },
    }),
    /English fallback locale is required/,
  )
  await fs.symlink(
    path.join(root, 'authoring/journal/locales/en_us.json'),
    path.join(root, 'authoring/journal/locales/de_de.json'),
  )
  await assert.rejects(
    editor.save({
      revision: snapshot.revision,
      changes: { 'journal/locales/de_de.json': '{}' },
    }),
    /symlinks/,
  )
})
test('structural edits keep label positions aligned; referenced quests cannot be deleted', async (t) => {
  const { documents, editor, snapshot } = await fixture(t)
  const id = 'travel/glider',
    chapter = documents['journal/chapters/travel.json'],
    def = chapter.entries.find((e) => e.id === 'glider').definition
  const docs = updateDefinition(documents, id, {
    ...def,
    objectives: [def.objectives[0], { ...def.objectives[0] }],
  })
  assert.deepEqual(Object.keys(docs[localePath('en_us')].entries[id].labels), [
    '0',
    '1',
  ])
  await editor.save({
    revision: snapshot.revision,
    changes: diff(snapshot, docs),
  })
  docs['journal/chapters/travel.json'].entries.find(
    (e) => e.id === 'membranes',
  ).definition.requirements = ['questlog:travel/glider']
  assert.throws(() => removeEntry(docs, id), /Referenced by/)
  const changed = await editor.read()
  const broken = removeEntry(documents, id)
  broken['journal/chapters/travel.json'].entries.find(
    (e) => e.id === 'membranes',
  ).definition.requirements = ['questlog:travel/glider']
  await assert.rejects(
    editor.save({ revision: changed.revision, changes: diff(changed, broken) }),
    /unknown required quest/,
  )
})

test('coordinated writes roll back ordinary replacement failures', async (t) => {
  const { root, editor, snapshot, documents } = await fixture(t)
  const docs = createEntry(
    documents,
    'travel',
    'rollback_route',
    'Rollback route',
    'minecraft:iron_ingot',
  )
  const original = fs.rename.bind(fs)
  let calls = 0
  const mocked = t.mock.method(fs, 'rename', async (...args) => {
    if (
      String(args[1]).startsWith(path.join(root, 'authoring') + path.sep) &&
      ++calls === 2
    )
      throw new Error('Injected replacement failure')
    return original(...args)
  })
  await assert.rejects(
    editor.save({ revision: snapshot.revision, changes: diff(snapshot, docs) }),
    (error) => error.code === 'STORAGE_UNAVAILABLE',
  )
  mocked.mock.restore()
  assert(
    calls >= 3,
    'the first committed source was restored after the second replacement failed',
  )
  assert.equal((await editor.read()).revision, snapshot.revision)
  for (const dir of ['journal/chapters', 'journal/locales'])
    assert.ok(
      !(await fs.readdir(path.join(root, 'authoring', dir))).some((name) =>
        name.endsWith('.tmp'),
      ),
    )
})
