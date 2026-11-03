import test from 'node:test'
import assert from 'node:assert/strict'
import { recipePresentation, safeIcon } from '../src/lib/recipe-view.mjs'

test('shaped recipes repeat slots and separate operating requirements', () => {
  const recipe = {
    id: 'test:shaped',
    type: 'minecraft:crafting',
    json: {
      type: 'minecraft:crafting_shaped',
      pattern: ['ABA', ' B '],
      key: { B: { tag: 'test:wood' }, A: { item: 'test:iron' } },
      result: { id: 'test:output', count: 3 },
    },
    ingredients: [
      ['test:oak', 'test:birch'],
      ['test:iron'],
      ['minecraft:crafting_table'],
    ],
  }
  const view = recipePresentation(recipe)
  assert.equal(view.columns, 3)
  assert.deepEqual(
    view.inputs.map((v) => v?.resolved ?? null),
    [
      ['test:iron'],
      ['test:oak', 'test:birch'],
      ['test:iron'],
      null,
      ['test:oak', 'test:birch'],
      null,
    ],
  )
  assert.deepEqual(view.requirements, [['minecraft:crafting_table']])
  assert.equal(view.outputs[0].value.count, 3)
  assert.equal(view.inputs[1].resolved.length, 2)
})
test('processing preserves fluids, probabilities, components and conditions', () => {
  const recipe = {
    id: 'test:processing',
    json: {
      type: 'create:mixing',
      ingredients: [{ fluid: 'minecraft:water', amount: 250 }],
      results: [
        {
          id: 'test:item',
          count: 2,
          chance: 0.25,
          components: { 'test:state': 'filled' },
        },
      ],
      heat_requirement: 'heated',
    },
    ingredients: [['fluid:minecraft/water'], ['atlas:heated']],
  }
  const view = recipePresentation(recipe)
  assert.equal(view.inputs.length, 1)
  assert.equal(view.inputs[0].value.amount, 250)
  assert.equal(view.outputs[0].value.chance, 0.25)
  assert.deepEqual(view.outputs[0].value.components, { 'test:state': 'filled' })
  assert.equal(view.conditions.heat_requirement, 'heated')
})
test('unsupported types keep source data without inventing a layout', () => {
  const recipe = {
    id: 'test:assembly',
    json: {
      type: 'create:sequenced_assembly',
      loops: 5,
      results: [{ id: 'test:part', chance: 120 }],
    },
  }
  assert.equal(recipePresentation(recipe).supported, false)
  assert.deepEqual(recipePresentation(recipe).inputs, [])
})
test('icon URLs only admit generated local assets', () => {
  assert.equal(safeIcon('javascript:alert(1)'), null)
  assert.equal(
    safeIcon('/generated/icons/ab12.svg'),
    '/generated/icons/ab12.svg',
  )
  assert.equal(safeIcon('/generated/icons/../../unsafe.svg'), null)
  assert.equal(safeIcon('https://example.com/icon.png'), null)
  const scoped =
    '/__atlas/workspaces/local/packs/create_sky/artifacts/' + 'a'.repeat(64)
  assert.equal(safeIcon(scoped), scoped)
  assert.equal(safeIcon(scoped + '?url=https://elsewhere.invalid'), null)
  assert.equal(
    safeIcon('/generated/icons/ab12.png'),
    '/generated/icons/ab12.png',
  )
})

test('smithing trim renders a modified base without a fixed sample output', () => {
  const recipe = {
    id: 'test:trim',
    output: 'minecraft:iron_chestplate',
    json: {
      type: 'minecraft:smithing_trim',
      template: { item: 'minecraft:bolt_armor_trim_smithing_template' },
      base: { tag: 'minecraft:trimmable_armor' },
      addition: { tag: 'minecraft:trim_materials' },
    },
    ingredients: [
      ['minecraft:bolt_armor_trim_smithing_template'],
      ['minecraft:leather_boots', 'minecraft:diamond_helmet'],
      ['minecraft:quartz'],
      ['minecraft:smithing_table'],
      ['minecraft:smithing_table'],
    ],
  }
  const view = recipePresentation(recipe)
  assert.equal(view.supported, true)
  assert.equal(view.derivedOutput, true)
  assert.equal(view.inputs.length, 3)
  assert.deepEqual(view.outputs, [{ derived: true, value: {}, resolved: [] }])
  assert.deepEqual(view.requirements, [['minecraft:smithing_table']])
})
