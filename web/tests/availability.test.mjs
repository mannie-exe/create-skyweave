import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEnvironment,
  validateEnvironmentPolicy,
  sourceUsable,
} from '../src/lib/availability.mjs'
import { acquisitionRoutes } from '../src/lib/acquisition.mjs'
import { solveProgression } from '../src/lib/progression.mjs'
import { methodMetrics, defaultMethod } from '../src/lib/method-comparison.mjs'
function fixture() {
  const policy = {
    context: 'dedicated',
    dimensions: [
      { id: 'minecraft:overworld', gate: 'atlas:overworld', access: 'initial' },
      {
        id: 'minecraft:the_nether',
        gate: 'atlas:nether',
        access: 'conditional',
        denyFeature: 'minecraft.nether_access',
        markedSetting: 'skyweave_compat:islands_v1',
      },
    ],
    lootBindings: [
      {
        tables: ['test:chests/shared'],
        structures: ['test:portal', 'test:fortress'],
        evidence: 'Two explicitly bound structure sources',
      },
    ],
  }
  const capture = {
    schema: 1,
    serverDefaults: { levelType: 'test:sky', allowNether: false },
    features: {
      'terrain.preset': true,
      'minecraft.nether_access': true,
      'terrain.structure_distribution': true,
      'yungsapi.island_structures': true,
    },
    structurePolicy: {
      frequencyMultiplier: 1,
      families: {
        portals: { maximumPerCluster: 1, targetStartsPer1024Chunks: 1 },
      },
    },
    presets: {
      'test:sky': {
        dimensions: {
          'minecraft:overworld': {
            generator: { settings: 'skyweave_compat:islands_v1' },
            biomes: ['test:nether_garden'],
          },
          'minecraft:the_nether': {
            generator: { settings: 'minecraft:nether' },
            biomes: ['test:pleasant_place'],
          },
        },
      },
    },
    biomes: {
      'test:nether_garden': {
        features: ['test:trees', 'test:ores'],
        spawns: ['test:crimson_sheep'],
      },
      'test:pleasant_place': { features: [], spawns: ['test:blaze'] },
    },
    placedFeatures: {
      'test:trees': { feature: 'test:oak' },
      'test:ores': { feature: 'test:iron' },
    },
    configuredFeatures: {
      'test:oak': {
        type: 'minecraft:tree',
        config: {
          trunk_provider: {
            type: 'minecraft:simple_state_provider',
            state: { Name: 'minecraft:oak_log' },
          },
          foliage_provider: {
            type: 'minecraft:simple_state_provider',
            state: { Name: 'minecraft:oak_leaves' },
          },
        },
      },
      'test:iron': {
        type: 'minecraft:ore',
        config: {
          size: 9,
          targets: [
            {
              state: { Name: 'minecraft:iron_ore' },
              target: { Name: 'test:predicate_not_output' },
            },
          ],
        },
      },
    },
    structures: {
      'test:portal': {
        biomes: ['test:nether_garden'],
        sets: ['test:portal_set'],
        family: 'portals',
        definition: { start_pool: 'test:starts', size: 1 },
      },
      'test:fortress': {
        biomes: ['test:pleasant_place'],
        sets: ['test:fortress_set'],
        definition: {},
      },
    },
    pools: {
      'test:starts': {
        fallback: 'minecraft:empty',
        elements: [
          {
            weight: 1,
            element: {
              element_type: 'minecraft:single_pool_element',
              location: 'test:portal',
            },
          },
        ],
      },
    },
    templates: {
      'test:portal': {
        blocks: ['minecraft:netherrack'],
        loot: ['test:chests/shared'],
        pools: [],
        entities: [],
        spawners: [],
      },
    },
  }
  const environment = buildEnvironment({ capture, policy })
  return { policy, capture, environment }
}
const route = (id, inputs, output, availability) => ({
  id,
  inputs,
  outputs: [output],
  kind: 'authored',
  availability,
})
test('template provenance merges stay local to each output and source map', () => {
  const { capture, policy } = fixture()
  capture.templates['test:portal'].blocks.push('test:shared_block')
  capture.templates['test:second'] = {
    blocks: ['test:shared_block', 'test:second_only'],
    loot: ['test:second_loot'],
    pools: [],
    entities: [],
    spawners: [],
  }
  capture.pools['test:starts'].elements.push({
    weight: 1,
    element: {
      element_type: 'minecraft:single_pool_element',
      location: 'test:second',
    },
  })
  const environment = buildEnvironment({ capture, policy })
  assert.deepEqual(environment.blocks.get('test:shared_block')[0].templates, [
    'test:portal',
    'test:second',
  ])
  assert.deepEqual(
    environment.blocks.get('minecraft:netherrack')[0].templates,
    ['test:portal'],
  )
  assert.deepEqual(environment.loot.get('test:chests/shared')[0].templates, [
    'test:portal',
  ])
  assert.deepEqual(environment.blocks.get('test:second_only')[0].templates, [
    'test:second',
  ])
})
test('native preset bindings replace dimension-name guesses and preserve Overworld exceptions', () => {
  const { environment } = fixture()
  assert.equal(environment.dimensions['minecraft:the_nether'].state, 'blocked')
  assert.equal(
    environment.mobs.get('test:crimson_sheep')[0].gate,
    'atlas:overworld',
  )
  assert.equal(environment.mobs.get('test:blaze')[0].state, 'blocked')
  assert.equal(
    environment.blocks.get('minecraft:oak_log')[0].gate,
    'atlas:overworld',
  )
  assert.ok(!environment.blocks.has('test:predicate_not_output'))
  assert.ok(environment.loot.get('test:chests/shared').some(sourceUsable))
  assert.ok(
    environment.loot
      .get('test:chests/shared')
      .some((source) => source.state === 'blocked'),
  )
  assert.equal(
    environment.blocks.get('minecraft:netherrack')[0].kind,
    'structure',
  )
})
test('effective feature selections, marked context and server defaults constrain access independently', () => {
  const { capture, policy } = fixture()
  policy.context = 'integrated'
  assert.equal(
    buildEnvironment({ capture, policy }).forGate('atlas:nether').state,
    'blocked',
  )
  capture.features['minecraft.nether_access'] = false
  assert.equal(
    buildEnvironment({ capture, policy }).forGate('atlas:nether').state,
    'potential',
  )
  delete capture.features['minecraft.nether_access']
  assert.equal(
    buildEnvironment({ capture, policy }).forGate('atlas:nether').state,
    'unknown',
  )
  policy.context = 'dedicated'
  assert.equal(
    buildEnvironment({ capture, policy }).forGate('atlas:nether').state,
    'blocked',
  )
  delete capture.presets['test:sky'].dimensions['minecraft:the_nether']
  assert.match(
    buildEnvironment({ capture, policy }).forGate('atlas:nether').reason,
    /not declared/,
  )
  assert.throws(() => buildEnvironment({ capture: null, policy }), /refresh/)
})
test('disabled structure families and missing positive set membership cannot provide new sources', () => {
  const { capture, policy } = fixture()
  capture.structurePolicy.families.portals.maximumPerCluster = 0
  let environment = buildEnvironment({ capture, policy })
  assert.ok(
    environment.blocks
      .get('minecraft:netherrack')
      .every((source) => source.state === 'blocked'),
  )
  capture.structurePolicy.families.portals.maximumPerCluster = 1
  capture.structures['test:portal'].sets = []
  environment = buildEnvironment({ capture, policy })
  assert.ok(
    environment.blocks
      .get('minecraft:netherrack')
      .every((source) => source.state === 'blocked'),
  )
  assert.equal(
    environment.explicit({
      gate: 'atlas:overworld',
      environment: { structures: ['test:missing'] },
    }).state,
    'unknown',
  )
})
test('closed access producers, unknown observations and self-conversions do not bootstrap progression', () => {
  const { environment } = fixture()
  const routes = [
    route('portal', [['atlas:overworld']], 'atlas:nether'),
    route('nether-only', [['atlas:nether']], 'test:rare'),
    route('observed', [['atlas:overworld']], 'test:unknown', {
      state: 'unknown',
      reason: 'Player placement is possible',
    }),
    route('downstream', [['test:rare']], 'test:machine'),
    route('self', [['test:block']], 'test:block'),
    route('salvage', [['atlas:overworld']], 'test:salvage'),
  ].map(environment.constrain)
  const roots = environment.roots(['atlas:overworld', 'atlas:nether'])
  const ids = [
    ...new Set([
      ...roots,
      ...routes.flatMap((route) => [...route.inputs.flat(), ...route.outputs]),
    ]),
  ]
  const solution = solveProgression(ids, roots, routes)
  assert.equal(solution.depth.has('atlas:nether'), false)
  assert.equal(solution.depth.has('test:machine'), false)
  assert.equal(solution.depth.has('test:unknown'), false)
  assert.equal(solution.depth.has('test:block'), false)
  assert.equal(solution.witnesses.get('test:salvage').route, 'salvage')
  const metrics = methodMetrics('test:rare', routes, roots)
  assert.equal(metrics.get('nether-only').status, 'blocked')
})
test('surveyed player blocks stay browsable without becoming natural gathering roots', () => {
  const { environment } = fixture()
  const args = {
    items: [{ id: 'test:block' }],
    blocks: [{ id: 'test:block', item: 'test:block', destroyTime: 1 }],
    loot: {
      'test:blocks/block': {
        pools: [{ entries: [{ type: 'minecraft:item', name: 'test:block' }] }],
      },
    },
    world: { blocks: { 'test:block': 1 } },
    resources: {},
    chiseling: [],
    brewing: [],
    trades: [],
    authored: { records: [] },
    fluids: [],
    environment,
  }
  const { routes } = acquisitionRoutes(args)
  const gathered = routes.find((route) => route.kind === 'gathering')
  assert.equal(gathered.availability.state, 'unknown')
  assert.equal(
    solveProgression(
      ['test:block', 'atlas:overworld'],
      ['atlas:overworld'],
      routes,
    ).depth.has('test:block'),
    false,
  )
})
test('default item selection follows graph policy while explicit choices remain authoritative', () => {
  const methods = [
    {
      id: 'blocked',
      label: 'Blocked',
      type: 'Loot',
      metrics: { status: 'blocked', planned: null, earliest: null },
    },
    {
      id: 'mine',
      label: 'Mine',
      type: 'Gathering',
      metrics: {
        status: 'ranked',
        planned: { depth: 2, opportunities: 0, unknowns: 0, random: 0 },
        earliest: { depth: 2 },
      },
    },
    {
      id: 'loot',
      label: 'Loot',
      type: 'Loot',
      metrics: {
        status: 'ranked',
        planned: { depth: 1, opportunities: 1, unknowns: 0, random: 1 },
        earliest: { depth: 1 },
      },
    },
  ]
  const detail = {
    path: [{ id: 'target', route: 'mine' }],
    earliestPath: [{ id: 'target', route: 'loot' }],
  }
  assert.equal(defaultMethod(methods, detail, 'target', 'planned'), 'mine')
  assert.equal(defaultMethod(methods, detail, 'target', 'earliest'), 'loot')
  assert.equal(
    defaultMethod(methods, detail, 'target', 'planned', 'blocked'),
    'blocked',
  )
  assert.equal(defaultMethod(methods, {}, 'target', 'planned'), 'mine')
  assert.equal(defaultMethod(methods, {}, 'target', 'earliest'), 'loot')
})
test('ambiguous source bindings and unknown dimensions are explicit rather than guessed', () => {
  const { policy } = fixture()
  policy.lootBindings[0].dimensions = ['minecraft:overworld']
  assert.throws(() => validateEnvironmentPolicy(policy), /one source kind/)
})
test('native singleton feature lists and weighted providers retain outputs without treating predicates as resources', () => {
  const { capture, policy } = fixture()
  capture.configuredFeatures['test:oak'] = {
    type: 'minecraft:simple_random_selector',
    config: {
      features: {
        feature: {
          type: 'minecraft:simple_block',
          config: {
            to_place: {
              type: 'minecraft:weighted_state_provider',
              entries: [
                { weight: 1, data: { Name: 'minecraft:oak_log' } },
                { weight: 0, data: { Name: 'test:disabled' } },
              ],
            },
          },
        },
        placement: [
          {
            type: 'minecraft:block_predicate_filter',
            predicate: { state: { Name: 'test:predicate' } },
          },
        ],
      },
    },
  }
  let environment = buildEnvironment({ capture, policy })
  assert.ok(environment.blocks.has('minecraft:oak_log'))
  assert.ok(!environment.blocks.has('test:disabled'))
  assert.ok(!environment.blocks.has('test:predicate'))
  capture.configuredFeatures[
    'test:oak'
  ].config.features.feature.config.to_place = {
    type: 'test:unknown_provider',
    state: { Name: 'test:not_proven_output' },
  }
  environment = buildEnvironment({ capture, policy })
  assert.ok(!environment.blocks.has('test:not_proven_output'))
})
test('template branches share one source context while retaining per-block template provenance', () => {
  const { capture, policy } = fixture()
  capture.pools['test:starts'].elements.push({
    weight: 1,
    element: {
      element_type: 'minecraft:single_pool_element',
      location: 'test:second',
    },
  })
  capture.templates['test:second'] = {
    blocks: ['minecraft:netherrack', 'test:unique'],
    pools: [],
    loot: [],
  }
  const environment = buildEnvironment({ capture, policy })
  const shared = environment.blocks.get('minecraft:netherrack')
  assert.equal(shared.length, 1)
  assert.deepEqual(shared[0].templates, ['test:portal', 'test:second'])
  assert.deepEqual(environment.blocks.get('test:unique')[0].templates, [
    'test:second',
  ])
})
test('placed and configured features with the same registry ID are distinct, while real cycles terminate', () => {
  const { capture, policy } = fixture()
  capture.biomes['test:nether_garden'].features.push('test:zinc')
  capture.placedFeatures['test:zinc'] = { feature: 'test:zinc' }
  capture.configuredFeatures['test:zinc'] = {
    type: 'minecraft:ore',
    config: { size: 9, targets: [{ state: { Name: 'test:zinc_ore' } }] },
  }
  let environment = buildEnvironment({ capture, policy })
  assert.ok(environment.blocks.has('test:zinc_ore'))
  capture.configuredFeatures['test:zinc'] = {
    type: 'minecraft:random_patch',
    config: { feature: 'test:zinc' },
  }
  environment = buildEnvironment({ capture, policy })
  assert.ok(!environment.blocks.has('test:zinc_ore'))
})
test('global loot modifiers inherit their bound source restrictions instead of guessing a dimension from the table name', () => {
  const { environment } = fixture()
  environment.loot.set('minecraft:chests/pleasant_place', [
    {
      id: 'closed',
      gate: 'atlas:nether',
      state: 'blocked',
      reason: 'Closed source',
    },
  ])
  const { routes } = acquisitionRoutes({
    items: [{ id: 'test:upgrade' }],
    blocks: [],
    loot: {},
    world: {},
    resources: {},
    chiseling: [],
    brewing: [],
    trades: [],
    authored: { records: [] },
    fluids: [],
    environment,
    lootModifiers: [
      {
        type: 'travelersbackpack:add_item',
        item: 'test:upgrade',
        conditions: [
          {
            condition: 'neoforge:loot_table_id',
            loot_table_id: 'minecraft:chests/pleasant_place',
          },
        ],
      },
    ],
  })
  assert.equal(routes.length, 1)
  assert.equal(routes[0].availability.state, 'blocked')
  assert.deepEqual(routes[0].inputs, [['atlas:nether'], ['atlas:exploration']])
})
