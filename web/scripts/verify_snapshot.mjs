import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { withWorkspace } from './workspace-cli.mjs'
import path from 'node:path'
import { verifyQuestSnapshot } from './verify-quests.mjs'
const projected = await withWorkspace(path.resolve('.'), async (workspace) =>
  Promise.all(
    ['catalog.json', 'coverage.json', 'routes.json'].map(async (name) =>
      JSON.parse(
        await fs.readFile(await workspace.projection('map', name), 'utf8'),
      ),
    ),
  ),
)
const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'))
const [recipes, items, errors, drops, diagnostics, catalog, coverage] =
  await Promise.all([
    read('data/generated/runtime/recipes.json'),
    read('data/generated/runtime/items.json'),
    read('data/generated/runtime/errors.json'),
    read('data/generated/runtime/patch_checks.json'),
    read('data/generated/diagnostics.json'),
    projected[0],
    projected[1],
  ])
const byRecipe = new Map(recipes.map((r) => [r.id, r])),
  byItem = new Map(items.map((i) => [i.id, i]))
const environment = await read('data/generated/runtime/environment.json')
assert.equal(environment.schema, 1)
assert.equal(
  environment.features['minecraft.nether_access'],
  true,
  'Capture the released Compat access adapter',
)
assert.equal(environment.serverDefaults.allowNether, false)
const template = await fs.readFile(
  '../templates/server/game/server.properties.template',
)
const { createHash } = await import('node:crypto')
assert.equal(
  environment.serverDefaults.sha256,
  createHash('sha256').update(template).digest('hex'),
  'Refresh changed environment defaults',
)
assert.equal(
  catalog.meta.environment.dimensions['minecraft:the_nether'].state,
  'blocked',
)
const mapRoutes = projected[2],
  nodes = new Map(catalog.nodes.map((node) => [node.id, node]))
for (const id of [
  'minecraft:oak_log',
  'minecraft:stone',
  'minecraft:cobblestone',
  'minecraft:sand',
  'minecraft:gravel',
  'minecraft:andesite',
  'minecraft:iron_ingot',
  'create:zinc_ingot',
  'minecraft:quartz',
])
  assert.equal(
    nodes.get(id)?.status,
    'mapped',
    id + ' must retain a traced acquisition path',
  )
assert(
  mapRoutes.some(
    (route) =>
      route.kind === 'gathering' &&
      route.outputs.includes('create:raw_zinc') &&
      route.availability?.state === 'potential',
  ),
  'Native Create ore declarations must contribute mining routes',
)
assert(
  mapRoutes.some(
    (route) =>
      route.kind === 'gathering' &&
      route.outputs.includes('minecraft:soul_sand') &&
      route.inputs.some((group) => group.includes('atlas:overworld')) &&
      route.availability?.state === 'potential',
  ),
  'Keep Overworld soul-sand salvage despite Nether closure',
)
const netherOnly = mapRoutes.filter(
  (route) =>
    route.outputs.includes('atlas:nether') ||
    route.inputs.some(
      (group) => group.length === 1 && group[0] === 'atlas:nether',
    ),
)
assert(netherOnly.length > 0)
assert(
  netherOnly.every((route) => route.availability?.state === 'blocked'),
  'Closed dimension routes must remain browsable but unavailable',
)
assert.deepEqual(errors, [], 'Exporter errors')
assert(
  !diagnostics.some((line) => line.includes('Parsing error loading recipe')),
  'Recipe loading failure',
)
assert.equal(
  catalog.nodes.length,
  items.length,
  'Every registered item must be on the map',
)
assert.equal(
  catalog.meta.counts.recipes,
  recipes.length,
  'Recompile the map after changing the runtime recipe snapshot',
)
assert(
  byRecipe
    .get('createdeco:placard')
    .ingredients.some((g) => g.includes('minecraft:white_dye')),
)
const chairs = recipes.filter(
  (r) => r.id.startsWith('interiors:') && r.id.includes('_from_other_'),
)
assert.equal(chairs.length, 32)
assert(
  chairs.every((r) =>
    r.ingredients.every((g) => g.length && !g.includes('minecraft:barrier')),
  ),
)
assert(
  byRecipe
    .get('bellsandwhistles:metro/metro_window')
    .ingredients.some((g) => g.includes('minecraft:glass')),
)
assert(
  byItem
    .get('dndecor:industrial_cogwheel')
    .tags.includes('dndecor:industrial_cogwheels'),
)
assert.equal(
  recipes.filter((r) => r.id.includes('pressing/zinc_sheet')).length,
  1,
)
assert.equal(
  byRecipe.get('createdeco:pressing/zinc_sheet').output,
  'createdeco:zinc_sheet',
)
for (const material of [
  'copper',
  'iron',
  'zinc',
  'lapis',
  'gold',
  'diamond',
  'emerald',
]) {
  const namespace = material === 'zinc' ? 'create' : 'minecraft'
  for (const variant of ['', 'deepslate_']) {
    const name = `${variant}${material}_ore`
    assert.deepEqual(
      byRecipe.get(`create:crushing/${name}`).ingredients,
      [[`${namespace}:${name}`]],
      `${name} must retain its geological input`,
    )
  }
}
for (const item of [
  'platinum_ore',
  'deepslate_platinum_ore',
  'raw_platinum_block',
]) {
  assert.equal(
    recipes.filter(
      (r) =>
        r.type === 'create:crushing' &&
        r.ingredients.some((g) => g.includes(`createpropulsion:${item}`)),
    ).length,
    1,
    `${item} must have one crushing route`,
  )
}
for (const [id, duration] of [
  ['createpropulsion:crushing/spruce_log', 150],
  ['createpropulsion:cutting/copycat_wing', 50],
])
  assert.equal(byRecipe.get(id).json.processing_time, duration, id)
assert.equal(
  byRecipe.get('createpropulsion:mixing/turpentine').json.heat_requirement ??
    'none',
  'none',
  'Turpentine must not acquire an implicit heat gate',
)
for (const [name, stacks] of Object.entries(drops))
  assert(
    stacks.some((s) => s.id === `createpropulsion:${name}` && s.count === 1),
    name + ' must drop itself',
  )
assert.equal(Object.keys(drops).length, 4)
for (const id of [
  'reliable_gliders:glider',
  'create:precision_mechanism',
  'createpropulsion:turpentine_bucket',
  'createbigcannons:cast_iron_cannon_barrel',
  'powergrid:circuit_schematic',
  'travelersbackpack:bat',
  'travelersbackpack:iron_golem',
])
  assert.equal(
    coverage.find((c) => c.id === id)?.status,
    'mapped',
    id + ' route',
  )
assert.equal(
  coverage.find((c) => c.id === 'minecraft:barrier').status,
  'excluded',
)
assert.equal(
  coverage.find((c) => c.id === 'powergrid:zinc_sheet').status,
  'unified',
)
assert.equal(
  coverage.find((c) => c.id === 'create_factory:spread_bucket').status,
  'blocked',
  'Ecologics-only fluid must not become a free resource',
)
const quests = await read('data/generated/runtime/quests.json')
assert.equal(quests.schema, 1)
assert.equal(quests.system, 'ftbquests')
assert.equal(quests.format, 13, 'Review the pinned native FTB writer format')
assert.equal(quests.progression, 'flexible')
const documents = {
  'quests/book.json': await read('../authoring/quests/book.json'),
}
for (const filename of await fs.readdir('../authoring/quests/chapters'))
  if (filename.endsWith('.json'))
    documents['quests/chapters/' + filename] = await read(
      '../authoring/quests/chapters/' + filename,
    )
const questEvidence = verifyQuestSnapshot(quests, documents, items)
console.log(
  'Snapshot checks passed:',
  catalog.meta.counts,
  'FTB quests:',
  questEvidence.quests,
)

const heat = await read('data/generated/runtime/heat_checks.json')
assert.equal(heat.solidBurnerCold, 'NONE')
assert(heat.coalAccepted > 0 && heat.heatedAtTick > 0)
assert(heat.superheatedAtTick > heat.heatedAtTick)
