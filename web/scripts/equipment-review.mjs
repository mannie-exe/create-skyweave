import fs from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import YAML from 'yaml'
import { equipmentReview } from '../src/lib/equipment.mjs'
import { acquisitionRoutes, processingRoute } from '../src/lib/acquisition.mjs'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({
  options: {
    runtime: { type: 'string' },
    catalog: { type: 'string' },
    output: { type: 'string' },
  },
})
const runtime = path.resolve(
  values.runtime ?? path.join(web, 'data/generated/runtime'),
)
const catalog = path.resolve(
  values.catalog ?? path.join(web, 'data/generated/catalog.json'),
)
const output = path.resolve(
  values.output ?? path.join(web, 'data/generated/equipment.json'),
)
const inputs = {}
const input = async (file) => {
  const bytes = await fs.readFile(file)
  inputs[path.basename(file)] = createHash('sha256').update(bytes).digest('hex')
  return bytes.toString('utf8')
}
const json = async (file) => JSON.parse(await input(file))
const [
  items,
  blocks,
  versions,
  recipes,
  loot,
  resources,
  chiseling,
  brewing,
  trades,
  fluids,
  potionFluids,
  blockRecipes,
  lootModifiers,
  snapshot,
  complete,
] = await Promise.all(
  [
    'items',
    'blocks',
    'mod_versions',
    'recipes',
    'loot',
    'resources',
    'chiseling',
    'brewing',
    'trades',
    'fluids',
    'potion_fluids',
    'block_recipes',
    'loot_modifiers',
    'snapshot',
    'complete',
  ].map((name) => json(path.join(runtime, name + '.json'))),
)
if (complete.minecraft !== '1.21.1' || snapshot.sourceChangedDuringExport)
  throw new Error(
    'Equipment review needs a complete, unchanged Minecraft 1.21.1 registry capture',
  )
const decorated = new Map((await json(catalog)).map((item) => [item.id, item]))
if (
  items.some((item) => !decorated.has(item.id)) ||
  decorated.size !== items.length
)
  throw new Error('Equipment catalog and registry capture differ')
const rulesPath = path.join(web, '../authoring/equipment.json')
const rules = await json(rulesPath)
const authored = YAML.parse(
  await input(path.join(web, 'data/authored/acquisition.yml')),
)
const progression = YAML.parse(
  await input(path.join(web, 'data/authored/progression.yml')),
)
const tags = {},
  fluidTags = {}
for (const item of items)
  for (const tag of item.tags) (tags[tag] ??= []).push(item.id)
for (const block of blocks)
  if (block.item !== 'minecraft:air')
    for (const tag of block.tags) (tags['block@' + tag] ??= []).push(block.item)
for (const fluid of fluids)
  for (const tag of fluid.tags ?? []) (fluidTags[tag] ??= []).push(fluid.id)
const processing = recipes.map((recipe) =>
  processingRoute(recipe, tags, progression.machines, fluidTags),
)
const acquisition = acquisitionRoutes({
  items,
  blocks,
  loot,
  world: {},
  resources,
  chiseling,
  brewing,
  trades,
  authored,
  fluids,
  potionFluids,
  blockRecipes,
  fluidTags,
  lootModifiers,
})
const result = equipmentReview({
  rules,
  items: items.map((item) => ({ ...item, name: decorated.get(item.id).name })),
  blocks,
  versions,
  routes: [...processing, ...acquisition.routes],
})
await Promise.all([
  input(fileURLToPath(import.meta.url)),
  input(path.join(web, 'src/lib/equipment.mjs')),
  input(path.join(web, 'src/lib/acquisition.mjs')),
])
result.provenance = {
  runtime: snapshot.runtime,
  lockSha256: snapshot.lockSha256,
  capturedAt: complete.time,
  inputs: Object.fromEntries(
    Object.entries(inputs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ),
}
await fs.mkdir(path.dirname(output), { recursive: true })
const temporary = output + '.' + process.pid + '.tmp'
await fs.writeFile(temporary, JSON.stringify(result))
await fs.rename(temporary, output)
console.log(
  JSON.stringify({
    output,
    equipment: result.entries.length,
    uncertain: result.uncertain.length,
    families: result.families.map((family) => ({
      id: family.id,
      count: family.count,
    })),
  }),
)
