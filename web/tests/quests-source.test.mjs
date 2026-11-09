import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { domainFixture } from './domain-fixture.mjs'
import {
  createQuest,
  removeQuest,
  updateQuest,
  createChapter,
  removeChapter,
  createGroup,
  removeGroup,
  updateChapter,
  chapterList,
  questList,
  localeText,
  localePath,
  encode,
  newCode,
  createShared,
  removeShared,
  sharedUses,
  setText,
  paragraphs,
  assertQuestShape,
} from '../src/lib/quests.mjs'
async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-quests-crud-')),
  )
  await fs.cp(
    path.resolve('../authoring/quests'),
    path.join(root, 'authoring/quests'),
    { recursive: true },
  )
  await fs.mkdir(path.join(root, 'authoring/changes'))
  await fs.mkdir(path.join(root, 'scripts'))
  for (const name of ['generate-quests.py', 'quests.py', 'audit-changes.py'])
    await fs.copyFile(
      path.resolve('../scripts', name),
      path.join(root, 'scripts', name),
    )
  const editor = domainFixture(t, root, 'quests'),
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
  Object.fromEntries([
    ...Object.entries(documents)
      .filter(
        ([name, value]) =>
          !snapshot.files[name] ||
          JSON.stringify(value) !==
            JSON.stringify(JSON.parse(snapshot.files[name].text)),
      )
      .map(([name, value]) => [name, encode(value)]),
    ...Object.keys(snapshot.files)
      .filter((name) => !Object.hasOwn(documents, name))
      .map((name) => [name, null]),
  ])
const find = (documents, key) =>
  questList(documents).find((row) => row.key === key)

test('chapter and quest CRUD preserve native IDs, sparse locales and native generation', async (t) => {
  const { root, editor, snapshot, documents } = await fixture(t)
  let docs = createChapter(documents, 'review', 'Review')
  docs = createQuest(
    docs,
    'review',
    'test_route',
    'Test route',
    'minecraft:iron_ingot',
  )
  const quest = find(docs, 'test_route'),
    task = quest.tasks[0]
  docs[localePath('de_de')] = {
    schema: 1,
    objects: { [quest.id]: { title: 'Testweg' } },
    shared: {},
  }
  const reward = {
    id: newCode(docs),
    type: 'item',
    item: { id: 'minecraft:iron_ingot' },
    count: 2,
    native: { team_reward: true },
  }
  docs = updateQuest(docs, quest.id, { rewards: [reward] })
  assertQuestShape(docs)
  assert.equal(localeText(docs, 'de_de').objects[task.id].title, 'Test route')
  await editor.save({
    revision: snapshot.revision,
    changes: diff(snapshot, docs),
  })
  const destination = path.join(
    root,
    'overrides/common/config/ftbquests/quests/chapters/review.snbt',
  )
  await assert.rejects(fs.access(destination), { code: 'ENOENT' })
  let saved = await editor.read()
  await editor.generate({ revision: saved.revision })
  const native = await fs.readFile(destination, 'utf8')
  assert.match(native, new RegExp(`id: "${quest.id}"`))
  assert.match(native, /count: 2/)
  assert.match(native, /team_reward: true/)
  assert.match(
    await fs.readFile(
      path.join(
        root,
        'overrides/common/config/ftbquests/quests/lang/de_de.snbt',
      ),
      'utf8',
    ),
    /Testweg/,
  )
  docs = updateQuest(docs, quest.id, { x: 8.25, y: -3.5 }, 'workshop')
  assert.equal(find(docs, 'test_route').id, quest.id)
  assert.equal(find(docs, 'test_route').tasks[0].id, task.id)
  docs = removeChapter(docs, 'review')
  saved = await editor.read()
  await editor.save({ revision: saved.revision, changes: diff(saved, docs) })
  saved = await editor.read()
  const review = await editor.artifactJSON(await editor.preview(saved.revision))
  assert.ok(
    review.removed.includes(
      'overrides/common/config/ftbquests/quests/chapters/review.snbt',
    ),
  )
  await editor.generate({ revision: saved.revision })
  await assert.rejects(fs.access(destination), { code: 'ENOENT' })
  assert.match(
    await fs.readFile(
      path.join(
        root,
        'overrides/common/config/ftbquests/quests/chapters/workshop.snbt',
      ),
      'utf8',
    ),
    new RegExp(quest.id),
  )
  docs = removeQuest(docs, quest.id)
  assert.equal(docs[localePath('de_de')].objects[quest.id], undefined)
})

test('native ID changes, referenced deletion and dependency cycles fail before mutation', async (t) => {
  const { documents } = await fixture(t)
  let docs = createQuest(
    documents,
    'workshop',
    'first_review',
    'First',
    'minecraft:stone',
  )
  docs = createQuest(
    docs,
    'crossings',
    'second_review',
    'Second',
    'minecraft:dirt',
  )
  const first = find(docs, 'first_review'),
    second = find(docs, 'second_review')
  docs = updateQuest(docs, second.id, { dependencies: [first.id] })
  assert.throws(() => removeQuest(docs, first.id), /Referenced by/)
  assert.throws(
    () => updateQuest(docs, first.id, { dependencies: [second.id] }),
    /cycle/,
  )
  assert.throws(
    () => updateQuest(docs, first.id, { id: newCode(docs) }),
    /stable/,
  )
  assert.throws(
    () => updateQuest(docs, first.id, { dependencies: ['1234567890ABCDEF'] }),
    /Unknown prerequisite/,
  )
  assert.equal(find(docs, 'first_review').dependencies.length, 0)
  assert.throws(() => removeChapter(docs, 'workshop'), /Move or delete/)
  docs = createGroup(docs, 'review_group', 'Review group')
  const group = docs['quests/book.json'].groups.find(
    (row) => row.key === 'review_group',
  )
  docs = updateChapter(docs, 'workshop', { group: group.id })
  assert.throws(() => removeGroup(docs, group.id), /Reassign/)
})

test('shared paragraphs remain references through locale editing and are protected on deletion', async (t) => {
  const { documents } = await fixture(t)
  let docs = createShared(documents, 'review_tip', 'English tip')
  const quest = questList(docs)[0]
  docs = setText(
    docs,
    'en_us',
    ['objects', quest.id, 'quest_desc'],
    ['First paragraph', { shared: 'review_tip' }],
  )
  docs[localePath('de_de')] = {
    schema: 1,
    objects: {},
    shared: { review_tip: 'Hinweis' },
  }
  assert.equal(sharedUses(docs, 'review_tip').length, 1)
  assert.deepEqual(sharedUses(docs, undefined), [])
  const words = localeText(docs, 'de_de')
  assert.deepEqual(
    paragraphs(words.objects[quest.id].quest_desc, words.shared),
    ['First paragraph', 'Hinweis'],
  )
  assert.throws(() => removeShared(docs, 'review_tip'), /references/)
  assertQuestShape(docs)
})

test('coordinated saves reject missing text, protected deletions, stale revisions and symlinked new sources', async (t) => {
  const { root, editor, snapshot, documents } = await fixture(t)
  const docs = createQuest(
    documents,
    'workshop',
    'test_route',
    'Test route',
    'minecraft:iron_ingot',
  )
  await assert.rejects(
    editor.save({
      revision: snapshot.revision,
      changes: {
        'quests/chapters/workshop.json': encode(
          docs['quests/chapters/workshop.json'],
        ),
      },
    }),
    /English|locale|text|objects/,
  )
  assert.equal((await editor.read()).revision, snapshot.revision)
  await assert.rejects(
    editor.save({ revision: '0'.repeat(64), changes: diff(snapshot, docs) }),
    (error) => error.code === 'REVISION_CONFLICT',
  )
  for (const name of ['quests/book.json', 'quests/locales/en_us.json'])
    await assert.rejects(
      editor.save({ revision: snapshot.revision, changes: { [name]: null } }),
    )
  await fs.symlink(
    path.join(root, 'authoring/quests/locales/en_us.json'),
    path.join(root, 'authoring/quests/locales/de_de.json'),
  )
  await assert.rejects(
    editor.save({
      revision: snapshot.revision,
      changes: { 'quests/locales/de_de.json': '{}' },
    }),
    /symlink/i,
  )
})

test('coordinated writes roll back replacements and remove their temporary files', async (t) => {
  const { root, editor, snapshot, documents } = await fixture(t)
  const docs = createQuest(
    documents,
    'workshop',
    'rollback_route',
    'Rollback route',
    'minecraft:iron_ingot',
  )
  const rename = fs.rename.bind(fs)
  let calls = 0
  const mock = t.mock.method(fs, 'rename', async (...args) => {
    if (
      String(args[1]).startsWith(path.join(root, 'authoring') + path.sep) &&
      ++calls === 2
    )
      throw new Error('Injected replacement failure')
    return rename(...args)
  })
  await assert.rejects(
    editor.save({ revision: snapshot.revision, changes: diff(snapshot, docs) }),
    (error) => error.code === 'STORAGE_UNAVAILABLE',
  )
  mock.mock.restore()
  assert.ok(calls >= 3)
  assert.equal((await editor.read()).revision, snapshot.revision)
  for (const dir of ['quests/chapters', 'quests/locales'])
    assert.ok(
      !(await fs.readdir(path.join(root, 'authoring', dir))).some((name) =>
        name.endsWith('.tmp'),
      ),
    )
})

test('edited native files reject generation without overwriting external changes', async (t) => {
  const { root, editor } = await fixture(t)
  await editor.generate({ revision: (await editor.read()).revision })
  const before = await editor.read(),
    native = path.join(
      root,
      'overrides/common/config/ftbquests/quests/chapters/workshop.snbt',
    )
  await fs.appendFile(native, '\n// External edit\n')
  await assert.rejects(
    editor.generate({ revision: before.revision }),
    /edit conflict/i,
  )
  await assert.rejects(
    editor.generate({ revision: (await editor.read()).revision }),
    /edited|conflict|changed/i,
  )
  assert.match(await fs.readFile(native, 'utf8'), /External edit/)
})
