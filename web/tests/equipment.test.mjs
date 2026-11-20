import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equipmentMembership, equipmentReview } from '../src/lib/equipment.mjs'

const rules = {
  schema: 1,
  decision: 'preserve-native-values',
  exclusions: [{ types: ['native.SpawnEgg'] }],
  families: [
    {
      id: 'tools',
      role: 'Harvesting',
      selectors: [{ types: ['native.Tool'] }],
    },
    {
      id: 'machines',
      role: 'Production',
      selectors: [{ namespaces: ['machines'], blockEntity: true }],
    },
  ],
}
const item = (id, type, components = {}) => ({
  id,
  name: id,
  class: type,
  types: [type],
  tags: [],
  components,
})

test('equipment review separates functional markers, decoration and unknown custom items', () => {
  const tool = item('minecraft:pickaxe', 'native.Tool')
  const motor = item('machines:motor', 'net.minecraft.world.item.Item')
  const wall = item('machines:wall', 'net.minecraft.world.item.Item')
  const unknown = item('example:controller', 'example.Controller')
  const food = item('example:fruit', 'example.Food', { 'minecraft:food': {} })
  const egg = item('example:egg', 'native.SpawnEgg')
  const block = (id, blockEntity) => ({
    id,
    item: id,
    blockEntity,
    types: ['native.Block'],
    tags: [],
  })
  const result = equipmentReview({
    rules,
    items: [tool, motor, wall, unknown, food, egg],
    blocks: [block(motor.id, true), block(wall.id, false)],
    versions: [],
    routes: [],
  })
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    [motor.id, tool.id],
  )
  assert.deepEqual(
    result.uncertain.map((entry) => entry.id),
    [unknown.id],
  )
  assert.equal(result.entries[0].provider.version, null)
  assert.equal(result.entries[0].acquisitionStatus, 'no-indexed-route')
})

test('equipment acquisition references retain conditional routes without normalizing their odds', () => {
  const tool = item('example:tool', 'native.Tool')
  const route = {
    id: 'loot:rare',
    outputs: [tool.id],
    conditions: [{ condition: 'native:eligible' }],
    chance: 0.15,
  }
  const result = equipmentReview({
    rules,
    items: [tool],
    blocks: [],
    versions: [{ id: 'example', version: '1.2.3', name: 'Example' }],
    routes: [route, { id: 'unrelated', outputs: ['example:stone'] }],
  })
  assert.deepEqual(result.routes, [route])
  assert.deepEqual(result.entries[0].acquisition, [route.id])
  assert.equal(result.entries[0].provider.version, '1.2.3')
  assert.equal(result.entries[0].decision, 'preserve-native-values')
})

test('equipment membership keeps block interfaces separate from held-tool types', () => {
  const interfaceRules = {
    ...rules,
    families: [{ id: 'tools', selectors: [{ types: ['native.Wrenchable'] }] }],
  }
  const machine = item('example:machine', 'net.minecraft.world.item.BlockItem')
  const block = {
    id: machine.id,
    item: machine.id,
    blockEntity: true,
    types: ['native.Wrenchable'],
    tags: [],
  }
  const result = equipmentReview({
    rules: interfaceRules,
    items: [machine],
    blocks: [block],
    versions: [],
    routes: [],
  })
  assert.deepEqual(result.entries, [])
  assert.deepEqual(
    result.uncertain.map((row) => row.id),
    [machine.id],
  )
  assert.match(result.uncertain[0].reason, /block-entity/)
  assert.deepEqual(
    equipmentMembership(interfaceRules, {
      ...machine,
      types: [...machine.types, 'native.Wrenchable'],
    }),
    ['tools'],
  )
})

test('equipment review ordering does not depend on native registry or route iteration', () => {
  const items = [
    item('z:tool', 'native.Tool'),
    item('a:tool', 'native.Tool'),
    item('z:custom', 'z.Custom'),
    item('a:custom', 'a.Custom'),
  ]
  const blocks = ['z:block', 'a:block'].map((id) => ({
    id,
    item: 'z:tool',
    blockEntity: false,
    types: ['native.Block'],
  }))
  const routes = ['z:route', 'a:route'].map((id) => ({
    id,
    outputs: ['z:tool', 'a:custom'],
    conditions: ['keep-native-order'],
  }))
  const options = { rules, items, blocks, versions: [], routes }
  const first = equipmentReview(options)
  const second = equipmentReview({
    ...options,
    items: [...items].reverse(),
    blocks: [...blocks].reverse(),
    routes: [...routes].reverse(),
  })
  assert.deepEqual(first, second)
  assert.deepEqual(
    first.entries.map((row) => row.id),
    ['a:tool', 'z:tool'],
  )
  assert.deepEqual(first.entries[1].blocks, ['a:block', 'z:block'])
  assert.deepEqual(first.uncertain[0].acquisition, ['a:route', 'z:route'])
  assert.deepEqual(
    routes.map((route) => route.id),
    ['z:route', 'a:route'],
  )
})

test('equipment review refuses stale native evidence and malformed definitions', () => {
  const tool = item('example:tool', 'native.Tool')
  assert.throws(
    () => equipmentMembership(rules, { ...tool, types: undefined }),
    /native registry capture/,
  )
  const malformed = {
    ...rules,
    families: [{ id: 'bad', selectors: [{ blockEntity: 'yes' }] }],
  }
  assert.throws(
    () => equipmentMembership(malformed, tool),
    /requires a boolean/,
  )
  const duplicate = {
    ...rules,
    families: [rules.families[0], rules.families[0]],
  }
  assert.throws(
    () =>
      equipmentReview({
        rules: duplicate,
        items: [tool],
        blocks: [],
        versions: [],
        routes: [],
      }),
    /Duplicate/,
  )
})
