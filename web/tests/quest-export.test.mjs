import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyQuestSnapshot } from '../scripts/verify-quests.mjs'
const id = (n) => n.toString(16).toUpperCase().padStart(16, '0')
function fixture() {
  const documents = {
    'quests/book.json': { schema: 1, groups: [] },
    'quests/chapters/review.json': {
      schema: 1,
      id: id(2),
      order: 0,
      quests: [
        {
          id: id(3),
          key: 'review',
          x: 0,
          y: 0,
          dependencies: [],
          tasks: [
            {
              id: id(4),
              type: 'item',
              count: 2,
              match: { items: ['minecraft:stone'] },
            },
          ],
          rewards: [
            {
              id: id(5),
              type: 'item',
              native: { team_reward: true, auto: 'disabled' },
            },
          ],
        },
      ],
    },
  }
  const row = (n, type, parent, fields = {}) => ({
    id: id(n),
    type,
    parent: id(parent),
    nativeRoundTrip: true,
    ...fields,
  })
  const native = {
    schema: 1,
    system: 'ftbquests',
    format: 13,
    progression: 'flexible',
    objects: [
      row(1, 'file', 0),
      row(2, 'chapter', 1),
      row(3, 'quest', 2, {
        dependencies: [],
        tasks: [id(4)],
        rewards: [id(5)],
      }),
      row(4, 'task', 3, {
        nativeType: 'ftbquests:item',
        maximumProgress: 2,
        matchingItems: ['minecraft:stone'],
      }),
      row(5, 'reward', 3, {
        nativeType: 'ftbquests:item',
        teamReward: true,
        collection: 'disabled',
      }),
    ],
  }
  return { documents, native }
}
test('native FTB evidence checks authored identities, links, selectors and claim policy', () => {
  const { documents, native } = fixture()
  assert.deepEqual(verifyQuestSnapshot(native, documents, []), {
    objects: 5,
    quests: 1,
    tasks: 1,
    rewards: 1,
    itemFilters: 1,
  })
  for (const modify of [
    (n) => n.objects.push({ ...n.objects[1] }),
    (n) => (n.objects[0].id = id(0)),
    (n) => (n.objects[3].matchingItems = ['minecraft:paper']),
    (n) => (n.objects[3].maximumProgress = 1),
    (n) => (n.objects[3].parent = id(2)),
    (n) => (n.objects[2].dependencies = [id(9)]),
    (n) => (n.objects[2].tasks = []),
    (n) => (n.objects[4].teamReward = false),
    (n) => (n.objects[4].collection = 'enabled'),
    (n) => (n.objects[0].nativeRoundTrip = false),
  ]) {
    const broken = structuredClone(native)
    modify(broken)
    assert.throws(() => verifyQuestSnapshot(broken, documents, []))
  }
})
