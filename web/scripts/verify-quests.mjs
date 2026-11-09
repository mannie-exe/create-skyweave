import assert from 'node:assert/strict'
import { objectList, questList } from '../src/lib/quests.mjs'

// Native decoding evidence is separate from gameplay, claims and saved progress.
export function verifyQuestSnapshot(quests, documents, items) {
  assert.equal(quests.schema, 1)
  assert.equal(quests.system, 'ftbquests')
  assert.equal(quests.format, 13, 'Review the pinned native FTB writer format')
  assert.equal(quests.progression, 'flexible')
  const authored = objectList(documents),
    nativeObjects = new Map(quests.objects.map((object) => [object.id, object]))
  assert.equal(
    nativeObjects.size,
    quests.objects.length,
    'Duplicate native FTB IDs',
  )
  assert.equal(
    nativeObjects.get('0000000000000001')?.type,
    'file',
    'Native ID 1 belongs to the file object',
  )
  assert.ok(
    quests.objects.every((object) => object.nativeRoundTrip),
    'Native objects must survive SNBT write/read',
  )
  assert.deepEqual(
    [...nativeObjects.keys()].filter((id) => id !== '0000000000000001').sort(),
    authored.map((object) => object.id).sort(),
    'Native FTB objects must match the authored book',
  )
  for (const object of authored) {
    const native = nativeObjects.get(object.id)
    assert.equal(native.type, object.type, object.id + ' object type')
    assert.equal(
      native.nativeRoundTrip,
      true,
      object.id + ' native SNBT round trip',
    )
    if (object.parent)
      assert.equal(native.parent, object.parent, object.id + ' parent')
    if (object.type === 'quest')
      assert.equal(
        native.parent,
        objectList(documents).find(
          (row) => row.type === 'chapter' && row.key === object.chapterKey,
        )?.id,
        object.id + ' chapter',
      )
    if (object.type === 'reward' && object.native?.team_reward !== undefined)
      assert.equal(
        native.teamReward,
        object.native.team_reward,
        object.id + ' claim scope',
      )
    if (object.type === 'reward' && object.native?.auto !== undefined)
      assert.equal(
        native.collection,
        object.native.auto,
        object.id + ' collection',
      )
    if (object.type === 'task' || object.type === 'reward')
      assert.equal(
        native.nativeType,
        'ftbquests:' + object.nativeType,
        object.id + ' native type',
      )
    if (object.type === 'task' && object.nativeType === 'item') {
      assert.equal(
        native.maximumProgress,
        object.count ?? 1,
        object.id + ' count',
      )
      const expected =
        object.match?.items ??
        (object.match?.tag
          ? items
              .filter((item) => item.tags.includes(object.match.tag))
              .map((item) => item.id)
          : [object.item.id])
      assert.ok(
        expected.length,
        object.id + ' selector has no registered items',
      )
      for (const id of expected)
        assert.ok(
          native.matchingItems.includes(id),
          object.id + ': missing native filter member ' + id,
        )
    }
  }
  for (const quest of questList(documents)) {
    assert.deepEqual(
      nativeObjects.get(quest.id).tasks,
      quest.tasks.map((task) => task.id),
      quest.id + ' task order',
    )
    assert.deepEqual(
      nativeObjects.get(quest.id).rewards,
      quest.rewards.map((reward) => reward.id),
      quest.id + ' reward order',
    )
    assert.deepEqual(
      nativeObjects.get(quest.id).dependencies,
      [...quest.dependencies].sort(),
      quest.id + ' prerequisites',
    )
  }
  return {
    objects: nativeObjects.size,
    quests: questList(documents).length,
    tasks: authored.filter((object) => object.type === 'task').length,
    rewards: authored.filter((object) => object.type === 'reward').length,
    itemFilters: authored.filter(
      (object) => object.type === 'task' && object.match,
    ).length,
  }
}
