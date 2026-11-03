import { enrichRoutes } from '../src/lib/acquisition-facts.mjs'
import { routeFamily } from '../src/lib/progression.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  analyzeRoutes,
  recipeInputs,
  recipeOutputs,
  layout,
  detailBucket,
} from '../src/lib/graph.mjs'
import {
  acquisitionRoutes,
  craftingConflicts,
  processingRoute,
  fluidNode,
} from '../src/lib/acquisition.mjs'
import { domains, validateDomain } from '../src/lib/domains.mjs'

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const compileInputs = [
  'catalog',
  'runtime/recipes',
  'runtime/blocks',
  'runtime/entities',
  'runtime/loot',
  'runtime/advancements',
  'documents',
  'configs',
  'mods',
  'diagnostics',
  'runtime/snapshot',
  'runtime/complete',
  'runtime/interactions',
  'runtime/hooks',
  'runtime/fluids',
  'world',
  'runtime/resources',
  'runtime/chiseling',
  'runtime/brewing',
  'runtime/trades',
  'runtime/potion_fluids',
  'runtime/block_recipes',
  'runtime/loot_modifiers',
  'structures',
  'islands',
]
async function compile(context) {
  const { web, output, pack } = context
  const generated = context.generated ?? path.join(web, 'data/generated')
  const read = async (name) => {
    if (!compileInputs.includes(name))
      throw new Error('Undeclared compile input')
    return JSON.parse(
      await fs.readFile(path.join(generated, name + '.json'), 'utf8'),
    )
  }
  const write = async (name, value) => {
    const p = path.join(output, name + '.json')
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p + '.tmp', JSON.stringify(value))
    await fs.rename(p + '.tmp', p)
  }
  const authored = {},
    revisions = {}
  for (const name of domains) {
    const text = await fs.readFile(
      path.join(web, 'data/authored', name + '.yml'),
      'utf8',
    )
    authored[name] = validateDomain(name, text)
    revisions[name] = crypto.createHash('sha256').update(text).digest('hex')
  }
  const [
    items,
    recipes,
    blocks,
    entities,
    loot,
    advancements,
    documents,
    configs,
    mods,
    diagnostics,
    snapshot,
    runtime,
    interactions,
    hooks,
    fluids,
  ] = await Promise.all([
    read('catalog'),
    read('runtime/recipes'),
    read('runtime/blocks'),
    read('runtime/entities'),
    read('runtime/loot'),
    read('runtime/advancements'),
    read('documents'),
    read('configs'),
    read('mods'),
    read('diagnostics'),
    read('runtime/snapshot'),
    read('runtime/complete'),
    read('runtime/interactions'),
    read('runtime/hooks'),
    read('runtime/fluids'),
  ])
  const tags = {},
    itemMap = new Map(items.map((i) => [i.id, i])),
    byOutput = {},
    byInput = {},
    lootByItem = {},
    routes = []
  for (const item of items)
    for (const tag of item.tags) (tags[tag] ??= []).push(item.id)
  for (const block of blocks)
    if (itemMap.has(block.item) && block.item !== 'minecraft:air')
      for (const tag of block.tags)
        (tags['block@' + tag] ??= []).push(block.item)
  const changes = new Map(authored.recipes.changes.map((c) => [c.id, c]))
  const active = []
  for (const recipe of recipes) {
    const change = changes.get(recipe.id)
    if (change?.disabled) continue
    const r = change?.json
      ? {
          ...recipe,
          json: change.json,
          type: change.json.type,
          ingredients: recipeInputs(change.json, tags),
          scenario: true,
        }
      : recipe
    active.push(r)
    changes.delete(recipe.id)
  }
  for (const change of changes.values())
    if (change.json)
      active.push({
        id: change.id,
        json: change.json,
        type: change.json.type,
        ingredients: recipeInputs(change.json, tags),
        scenario: true,
      })
  const [
    world,
    resources,
    chiseling,
    brewing,
    trades,
    potionFluids,
    blockRecipes,
    lootModifiers,
  ] = await Promise.all([
    read('world').catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    }),
    read('runtime/resources'),
    read('runtime/chiseling'),
    read('runtime/brewing'),
    read('runtime/trades'),
    read('runtime/potion_fluids'),
    read('runtime/block_recipes'),
    read('runtime/loot_modifiers'),
  ])
  const fluidTags = {}
  for (const f of fluids)
    for (const tag of f.tags ?? []) (fluidTags[tag] ??= []).push(f.id)
  for (const recipe of active) {
    const route = processingRoute(
      recipe,
      tags,
      authored.progression.machines,
      fluidTags,
    )
    route.scenario = Boolean(recipe.scenario)
    recipe.outputs = route.outputs
    recipe.ingredients = route.inputs
    recipe.source =
      resources[recipe.id.replace(':', ':recipe/') + '.json'] ??
      documents[recipe.id.replace(':', ':recipe/') + '.json']?.map(
        ({ json, ...source }) => source,
      ) ??
      []
    routes.push(route)
    for (const id of recipe.outputs) (byOutput[id] ??= []).push(recipe.id)
    for (const id of new Set(route.inputs.flat()))
      (byInput[id] ??= []).push(recipe.id)
  }
  for (const record of authored.interactions.records)
    if (record.inputs?.length && record.outputs?.length)
      routes.push({ kind: 'interaction', ...record })
  routes.push(...interactions.map((r) => ({ kind: 'interaction', ...r })))
  const acquisition = acquisitionRoutes({
    items,
    blocks,
    loot,
    world: world ?? {},
    resources,
    chiseling,
    brewing,
    trades,
    authored: authored.acquisition,
    fluids,
    potionFluids,
    blockRecipes,
    lootModifiers,
    fluidTags,
  })
  routes.push(...acquisition.routes)
  const roots = [
    ...authored.progression.roots,
    ...authored.acquisition.records.flatMap((r) => r.roots ?? []),
  ]
  const ids = [
    ...new Set([
      ...items.map((i) => i.id),
      ...routes.flatMap((r) => [...r.inputs.flat(), ...r.outputs]),
      ...roots,
    ]),
  ]
  const excluded = [
    ...authored.acquisition.records.flatMap((r) => r.excluded ?? []),
    ...items.filter((i) => i.class.endsWith('SpawnEggItem')).map((i) => i.id),
  ]
  enrichRoutes(routes, active, loot, tags, fluidTags)
  const earliest = analyzeRoutes(ids, roots, routes, excluded, 'earliest')
  const analysis = analyzeRoutes(ids, roots, routes, excluded, 'planned'),
    depth = analysis.depth
  const aliases = authored.acquisition.records.flatMap((r) => r.aliases ?? [])
  for (const alias of aliases) {
    const coverage = analysis.coverage.get(alias.id)
    if (coverage && !depth.has(alias.id)) {
      coverage.status = 'unified'
      coverage.canonical = alias.canonical
    }
  }
  const routeById = Object.fromEntries(routes.map((r) => [r.id, r]))
  function lootNames(value, found = new Set()) {
    if (!value || typeof value !== 'object') return found
    if (value.type === 'minecraft:item' && value.name) found.add(value.name)
    for (const child of Object.values(value))
      if (typeof child === 'object') lootNames(child, found)
    return found
  }
  for (const [id, table] of Object.entries(loot))
    for (const item of lootNames(table)) (lootByItem[item] ??= []).push(id)
  const recipesById = Object.fromEntries(active.map((r) => [r.id, r]))
  const blockMap = Object.fromEntries(blocks.map((b) => [b.id, b]))
  const buckets = {}
  for (const item of items) {
    const detail = {
      ...item,
      coverage: analysis.coverage.get(item.id),
      path: depth.has(item.id) ? analysis.pathFor(item.id) : [],
      earliestPath: earliest.depth.has(item.id)
        ? earliest.pathFor(item.id)
        : [],
      acquisition: (analysis.producing.get(item.id) ?? []).filter(
        (r) => r.kind !== 'recipe',
      ),
      block: blockMap[item.id],
      note: authored.items.notes[item.id],
      interactions: [...interactions, ...authored.interactions.records].filter(
        (r) =>
          r.outputs?.includes(item.id) || r.inputs?.flat().includes(item.id),
      ),
      hooks: hooks.find((h) => h.id === item.class),
      recipes: (byOutput[item.id] ?? []).map((id) => recipesById[id]),
      uses: (byInput[item.id] ?? []).map((id) => recipesById[id]),
      drops: (lootByItem[item.id] ?? []).map((id) => ({ id, json: loot[id] })),
    }
    ;(buckets[item.mod + '/' + detailBucket(item.id)] ??= {})[item.id] = detail
  }
  for (const [mod, bucket] of Object.entries(buckets))
    await write('details/' + mod, bucket)
  for (const mod of new Set(items.map((i) => i.mod)))
    await fs.rm(path.join(output, 'details', mod + '.json'), {
      force: true,
    })
  const nodes = layout(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      kind: 'item',
      status: analysis.coverage.get(item.id).status,
      routeCount: analysis.coverage.get(item.id).routeCount,
      mod: item.mod,
      icon: item.icon?.url ?? null,
      depth: depth.get(item.id) ?? null,
      family: analysis.witnesses.has(item.id)
        ? routeFamily(routeById[analysis.witnesses.get(item.id).route])
        : 'unresolved',
      progression: Object.fromEntries(
        [
          ['planned', analysis],
          ['earliest', earliest],
        ].map(([policy, result]) => [
          policy,
          {
            ...result.labels.get(item.id),
            depth: result.depth.get(item.id) ?? null,
            route: result.witnesses.get(item.id)?.route ?? null,
            family: result.witnesses.has(item.id)
              ? routeFamily(routeById[result.witnesses.get(item.id).route])
              : 'unresolved',
          },
        ]),
      ),
      recipeCount: byOutput[item.id]?.length ?? 0,
      usesCount: byInput[item.id]?.length ?? 0,
      hasNote: !!authored.items.notes[item.id],
      tagCount: item.tags.length,
    })),
  )
  const duplicates = Object.entries(tags)
    .filter(
      ([tag, ids]) =>
        /^c:(plates|ingots|nuggets|raw_materials)\//.test(tag) &&
        ids.length > 1,
    )
    .map(([tag, ids]) => ({ tag, ids }))
  await write('catalog', {
    nodes,
    meta: {
      minecraft: runtime.minecraft,
      capturedAt: runtime.time,
      compiledAt: new Date().toISOString(),
      lockSha256: snapshot.lockSha256,
      revisions,
      counts: {
        items: items.length,
        blocks: blocks.length,
        recipes: recipes.length,
        scenarioRecipes: active.length,
        entities: entities.length,
        loot: Object.keys(loot).length,
        advancements: Object.keys(advancements).length,
        unresolved: nodes.filter((n) => n.depth === null).length,
        mapped: nodes.filter((n) => n.status === 'mapped').length,
        blocked: nodes.filter((n) => n.status === 'blocked').length,
        unmapped: nodes.filter((n) => n.status === 'unmapped').length,
        excluded: nodes.filter((n) => n.status === 'excluded').length,
        unified: nodes.filter((n) => n.status === 'unified').length,
        acquisition: acquisition.routes.length,
        blockRecipes: blockRecipes.length,
        chiseling: chiseling.length,
        brewing: brewing.length,
        trades: trades.length,
      },
      limitations: authored.progression.limitations,
    },
  })
  await write('domains', {
    authored,
    coverage: [...analysis.coverage.values()]
      .filter((r) => itemMap.has(r.id) && r.status !== 'mapped')
      .sort((a, b) => b.downstream - a.downstream),
    acquisition: acquisition.routes,
    brewing,
    trades,
    blockRecipes,
    lootModifiers,
    entities: entities.map((e) => ({ ...e, loot: loot[e.lootTable] })),
    advancements,
    duplicates,
    conflicts: craftingConflicts(active, tags),
    configs,
    interactions,
    hooks,
    fluids,
    mods: mods.map(({ metadata, ...m }) => m),
    diagnostics,
    blocks: blocks.filter((b) => b.item === 'minecraft:air'),
    resources: Object.entries(documents)
      .filter(
        ([id]) =>
          !id.includes(':recipe/') &&
          !id.includes(':loot_table/') &&
          !id.includes(':advancement/'),
      )
      .map(([id, versions]) => ({ id, versions })),
  })
  await write('routes', routes)
  await write('coverage', [...analysis.coverage.values()])
  await write('recipes', active)
  await write('loot', loot)
  await write('world', world)
  const structures = await read('structures').catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (structures) {
    const processor = await fs.readFile(
      path.join(
        pack,
        'pack-fixes/data/skyvillages/worldgen/processor_list/house_processor.json',
      ),
    )
    structures.stale =
      structures.sourceFingerprint !== snapshot.sourceFingerprint ||
      structures.processorSha256 !==
        crypto.createHash('sha256').update(processor).digest('hex')
  }
  await write('structures', structures)
  await write(
    'islands',
    await read('islands').catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    }),
  )
  await write('authored', authored)
  console.log(
    `Compiled ${nodes.length} items, ${active.length} recipes; ${nodes.filter((n) => n.depth === null).length} unresolved crafting routes`,
  )
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (!args.length)
    throw new Error(
      'Use pnpm data:compile to publish through the workspace service.',
    )
  else {
    // Only the named executor supplies these roots. There is no browser path input.
    if (
      ![6, 8].includes(args.length) ||
      args[0] !== '--web' ||
      args[2] !== '--pack' ||
      args[4] !== '--output' ||
      [args[1], args[3], args[5]].some((value) => !path.isAbsolute(value)) ||
      (args.length === 8 && (args[6] !== '--data' || !path.isAbsolute(args[7])))
    )
      throw new Error(
        'Expected absolute --web, --pack and --output directories',
      )
    await compile({
      web: args[1],
      pack: args[3],
      output: args[5],
      ...(args.length === 8 ? { generated: args[7] } : {}),
    })
  }
}
