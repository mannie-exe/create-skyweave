// Potential acquisition routes. Every environmental edge retains its conditions;
// graph reachability never promises a spawn, yield, travel time or component value.
export const fluidNode = (id) => `fluid:${id.replace(':', '/')}`
export const fluidState = (stack) => {
  const base = fluidNode(stack.id ?? stack.fluid),
    potion = stack.components?.['minecraft:potion_contents']?.potion
  return potion
    ? `${base}/${potion.replace(':', '/')}/${stack.components?.['create:potion_fluid_bottle_type'] ?? 'regular'}`
    : base
}
export const potionNode = (stack) => {
  const potion = stack.components?.['minecraft:potion_contents']?.potion
  return potion
    ? `potion:${stack.id.replace(':', '/')}/${potion.replace(':', '/')}`
    : stack.id
}
export function ingredient(value, tags, fluidTags = {}) {
  if (Array.isArray(value))
    return value.flatMap((v) => ingredient(v, tags, fluidTags))
  if (typeof value === 'string')
    return value.startsWith('#') ? (tags[value.slice(1)] ?? []) : [value]
  if (value?.type === 'neoforge:difference') {
    const removed = new Set(ingredient(value.subtracted, tags, fluidTags))
    return ingredient(value.base, tags, fluidTags).filter(
      (id) => !removed.has(id),
    )
  }
  if (value?.type === 'neoforge:intersection') {
    const groups = (value.children ?? []).map((v) =>
      ingredient(v, tags, fluidTags),
    )
    return (groups[0] ?? []).filter((id) => groups.every((g) => g.includes(id)))
  }
  if (
    value?.fluids &&
    value.components?.['minecraft:potion_contents']?.potion &&
    typeof value.fluids === 'string'
  )
    return [fluidState({ id: value.fluids, components: value.components })]
  if (value?.fluids) {
    const values = Array.isArray(value.fluids) ? value.fluids : [value.fluids]
    return values.flatMap((v) =>
      v.startsWith('#')
        ? (fluidTags[v.slice(1)] ?? []).map(fluidNode)
        : [fluidNode(v)],
    )
  }
  if (value?.items) return ingredient(value.items, tags, fluidTags)
  if (value?.type === 'neoforge:block_tag')
    return tags['block@' + value.tag] ?? []
  if (value?.item) return [value.item]
  if (value?.fluid) return [fluidNode(value.fluid)]
  if (value?.tag)
    return value.type?.includes('fluid') || value.amount !== undefined
      ? (fluidTags[value.tag] ?? []).map(fluidNode)
      : (tags[value.tag] ?? [])
  if (value?.type === 'neoforge:compound')
    return ingredient(value.children, tags, fluidTags)
  return []
}
export function processingRoute(recipe, tags, machines, fluidTags = {}) {
  const json = recipe.json ?? {},
    type = json.type ?? recipe.type
  const decode = (v) => ingredient(v, tags, fluidTags)
  const declared =
    json.ingredients ??
    (json.ingredient
      ? [json.ingredient]
      : json.key
        ? Object.values(json.key)
        : json.base
          ? [json.template, json.base, json.addition].filter(Boolean)
          : null)
  const inputs = declared
    ? declared.map(decode)
    : (recipe.ingredients ?? []).map((v) => [...v])
  const outputs = (json.results ?? (json.result ? [json.result] : []))
    .filter((v) => v.chance !== 0)
    .map((v) =>
      typeof v === 'string'
        ? v
        : v.amount !== undefined
          ? fluidState(v)
          : (v.id ?? v.item),
    )
    .filter(Boolean)
  // SmithingTrimRecipe.getResultItem is a sample armor stack. Trimming changes
  // the supplied stack's components, not its item identity or acquisition.
  if (
    recipe.output &&
    recipe.output !== 'minecraft:air' &&
    !recipe.scenario &&
    type !== 'minecraft:smithing_trim'
  )
    outputs.push(recipe.output)
  const requirements = (step) => {
    const machine = machines[step.type] ?? machines[recipe.type]
    if (machine) inputs.push([machine])
    if (
      /^create:(mixing|compacting|pressing|crushing|milling|cutting|deploying|mechanical_crafting|splashing|haunting)$/.test(
        step.type,
      )
    )
      inputs.push(['atlas:rotation'])
    if (['create:mixing', 'create:compacting'].includes(step.type))
      inputs.push(['create:basin'])
    if (step.heat_requirement === 'heated') inputs.push(['atlas:heated'])
    if (step.heat_requirement === 'superheated')
      inputs.push(['atlas:superheated'])
    if (step.type === 'create:splashing')
      inputs.push([fluidNode('minecraft:water')])
    if (step.type === 'create:haunting')
      inputs.push(['minecraft:soul_sand', 'minecraft:soul_soil'])
    if (
      [
        'minecraft:smelting',
        'minecraft:blasting',
        'minecraft:smoking',
        'minecraft:campfire_cooking',
      ].includes(step.type)
    )
      inputs.push(['atlas:heat'])
    if (step.type === 'createbigcannons:melting')
      inputs.push(['createbigcannons:basin_foundry_lid'], ['create:basin'])
    if (step.type === 'create:sandpaper_polishing')
      inputs.push(['create:sand_paper', 'create:red_sand_paper'])
  }
  requirements({ ...json, type })
  if (type === 'create:sequenced_assembly') {
    const transitional = json.transitional_item?.id
    for (const step of json.sequence ?? []) {
      // The first slot is the workpiece from the previous step, not a new resource.
      // Its alternatives can include the base ingredient on the first pass.
      const groups = (step.ingredients ?? []).map(decode)
      for (const group of groups.slice(1)) inputs.push(group)
      if (groups.length && !groups[0].includes(transitional))
        inputs.push(groups[0])
      requirements(step)
    }
    if (transitional) outputs.push(transitional)
  }
  if (
    (json.pattern &&
      (json.pattern.length > 2 || json.pattern.some((r) => r.length > 2))) ||
    (type.includes('shapeless') && (declared?.length ?? 0) > 4)
  )
    inputs.push(['minecraft:crafting_table'])
  if (
    type.startsWith('minecraft:smithing_') &&
    !inputs.some(
      (group) => group.length === 1 && group[0] === 'minecraft:smithing_table',
    )
  )
    inputs.push(['minecraft:smithing_table'])
  return {
    id: recipe.id,
    kind: 'recipe',
    inputs,
    outputs: [...new Set(outputs)],
    conditions: json.heat_requirement ? [json.heat_requirement] : [],
    source: recipe.id,
    detail:
      type === 'create:sequenced_assembly'
        ? `Sequence repeated ${json.loops} times; outputs are weighted alternatives, not simultaneous guarantees.`
        : 'Amounts, probabilities and components remain in the recipe record.',
  }
}

// Traverse table references and alternative branches without losing inherited
// conditions. A self-drop is never an independent source of the same block.
export function lootEntries(
  id,
  tables,
  seen = new Set(),
  inherited = [],
  functions = [],
) {
  if (seen.has(id) || !tables[id]) return []
  const next = new Set([...seen, id]),
    found = []
  const walk = (entry, conditions, funcs) => {
    const all = [...conditions, ...(entry.conditions ?? [])],
      fns = [...funcs, ...(entry.functions ?? [])]
    if (entry.type === 'minecraft:item')
      found.push({
        item: entry.name,
        conditions: all,
        functions: fns,
        table: id,
      })
    if (
      entry.type === 'minecraft:loot_table' &&
      typeof (entry.value ?? entry.name) === 'string'
    )
      found.push(
        ...lootEntries(entry.value ?? entry.name, tables, next, all, fns),
      )
    let previous = []
    for (const child of entry.children ?? []) {
      walk(child, [...all, ...previous], fns)
      if (entry.type === 'minecraft:alternatives' && child.conditions?.length)
        previous.push({
          condition: 'minecraft:inverted',
          term: { condition: 'minecraft:all_of', terms: child.conditions },
        })
    }
  }
  const table = tables[id]
  for (const pool of table.pools ?? [])
    for (const entry of pool.entries ?? [])
      walk(
        entry,
        [...inherited, ...(pool.conditions ?? [])],
        [...functions, ...(table.functions ?? []), ...(pool.functions ?? [])],
      )
  return found
}
function conditionTools(condition) {
  if (condition.condition === 'minecraft:inverted') return []
  if (condition.condition === 'minecraft:any_of') {
    const branches = condition.terms.map(conditionTools)
    if (branches.every((b) => b.length === 1)) return [branches.flat(2)]
    return [] // Full expression is retained as a residual condition.
  }
  if (condition.terms) return condition.terms.flatMap(conditionTools)
  if (condition.ability?.startsWith('shears')) return [['minecraft:shears']]
  if (condition.condition === 'minecraft:match_tool') {
    if (JSON.stringify(condition).includes('minecraft:silk_touch'))
      return [['atlas:silk_touch']]
    const items = condition.predicate?.items
    if (items && !String(items).startsWith('#'))
      return [Array.isArray(items) ? items : [items]]
  }
  return []
}
export function miningTool(block) {
  if (!block.requiresCorrectTool) return []
  const tags = block.tags ?? []
  const tier = tags.includes('minecraft:needs_diamond_tool')
    ? 'diamond'
    : tags.includes('minecraft:needs_iron_tool')
      ? 'iron'
      : tags.includes('minecraft:needs_stone_tool')
        ? 'stone'
        : 'wooden'
  const tool = ['pickaxe', 'axe', 'shovel', 'hoe'].find((t) =>
    tags.includes('minecraft:mineable/' + t),
  )
  const tiers = ['wooden', 'stone', 'iron', 'diamond', 'netherite']
  return tool
    ? [tiers.slice(tiers.indexOf(tier)).map((t) => `minecraft:${t}_${tool}`)]
    : [[]]
}
export function acquisitionRoutes({
  items,
  blocks,
  loot,
  world,
  resources,
  chiseling,
  brewing,
  trades,
  authored,
  fluids,
  potionFluids = [],
  blockRecipes = [],
  fluidTags = {},
  lootModifiers = [],
  environment,
}) {
  const known = new Set(items.map((i) => i.id)),
    routes = [],
    virtual = new Map()
  const add = (r) => {
    if (environment) environment.constrain(r)
    routes.push(r)
    for (const id of [...r.inputs.flat(), ...r.outputs])
      if (!known.has(id)) virtual.set(id, { id })
  }
  const lootContexts = (id) =>
    environment?.loot.get(id) ?? [
      {
        id: 'unclassified',
        state: 'unknown',
        reason:
          'No admitted structure/event binding for this registered loot table',
      },
    ]
  for (const record of authored.records)
    if (record.inputs?.length && record.outputs?.length)
      add({
        kind: 'authored',
        ...record,
        ...(environment ? { availability: environment.explicit(record) } : {}),
      })
  const natural = new Map(
    [...(environment?.blocks ?? [])].map(([id, contexts]) => [
      id,
      contexts.map((context) => ({
        id: context.id,
        gate: context.gate,
        source:
          context.features ??
          context.templates ??
          context.structures ??
          context.dimensions,
        availability: context,
        sourceKind: context.kind,
        detail: context.reason,
      })),
    ]),
  )
  // A block observation can be player-built. Keep it browsable, but it cannot
  // establish global natural generation or bootstrap first access.
  for (const id of Object.keys(world.blocks ?? {}))
    if (!natural.has(id))
      natural.set(id, [
        {
          id: 'world-survey',
          gate: 'atlas:overworld',
          source: 'world survey',
          availability: {
            state: 'unknown',
            reason:
              'Observed block; natural origin, ownership and availability are unclassified',
            evidence: 'saved-world observation',
          },
          detail: `Observed in sampled chunks${world.completedAt ? ` captured ${world.completedAt}` : ''}. ${world.provenance ? 'World identity is recorded in World & ores.' : 'Legacy survey; world identity is absent.'} This does not establish natural generation or initial supplies.`,
        },
      ])
  for (const record of authored.records)
    for (const id of record.blocks ?? [])
      natural.set(id, [
        // A survey can include placed blocks. Keep it in World evidence, but
        // don't let that observation bypass the declared source restrictions.
        ...(natural.get(id) ?? []).filter(
          (context) => context.id !== 'world-survey',
        ),
        {
          id: record.id,
          gate: record.gate,
          source: record.sources,
          detail: record.detail,
          availability: environment?.explicit(record),
          sourceKind: record.environment?.structures?.length
            ? 'structure'
            : 'authored',
        },
      ])
  for (const block of blocks) {
    const table = block.lootTable ?? block.id.replace(':', ':blocks/')
    if (!loot[table] || block.destroyTime < 0) continue
    const locations = []
    for (const n of natural.get(block.id) ?? []) {
      locations.push({
        id: n.id,
        inputs: [
          [n.gate],
          ...(n.sourceKind === 'structure' ? [['atlas:exploration']] : []),
        ],
        availability: n.availability,
        sourceKind: n.sourceKind,
        source: n.source,
        detail: n.detail,
        kind: 'gathering',
      })
    }
    if (block.item !== 'minecraft:air' && known.has(block.item))
      locations.push({
        id: 'placed-block',
        inputs: [[block.item]],
        source: block.id,
        detail:
          'Place and break an already acquired block. This does not establish initial access.',
        kind: 'block-drop',
      })
    for (const location of locations) {
      for (const [index, entry] of lootEntries(table, loot).entries()) {
        if (!known.has(entry.item)) continue
        if (location.kind === 'block-drop' && entry.item === block.item)
          continue
        add({
          id: `${location.kind}/${block.id}/${location.id}/${index}`,
          kind: location.kind,
          inputs: [
            ...location.inputs,
            ...miningTool(block),
            ...entry.conditions.flatMap(conditionTools),
          ],
          outputs: [entry.item],
          conditions: entry.conditions,
          functions: entry.functions,
          source: table,
          lootTable: table,
          availability: location.availability,
          sourceKind: location.sourceKind,
          context: location.source,
          detail: location.detail,
        })
      }
    }
  }
  // Native biome-source membership supplies dimensions; names do not.
  const mobSources = new Map(
    [...(environment?.mobs ?? [])].map(([mob, contexts]) => [
      mob,
      [...contexts],
    ]),
  )
  for (const [id, resource] of Object.entries(resources))
    if (id.includes(':worldgen/biome/'))
      for (const list of Object.values(resource.json.spawners ?? {}))
        for (const spawn of list)
          if (!mobSources.has(spawn.type))
            mobSources.set(spawn.type, [
              {
                id: 'unclassified-biome',
                state: 'unknown',
                reason:
                  'Registered biome spawns have no admitted dimension/generator binding',
              },
            ])
  for (const record of authored.records)
    for (const mob of record.entities ?? []) {
      const contexts = mobSources.get(mob) ?? []
      contexts.push({
        ...(environment?.explicit(record) ?? {
          state: 'potential',
          reason: record.detail,
        }),
        id: record.id,
        gate: record.gate,
        kind: record.environment?.structures?.length ? 'structure' : 'authored',
        detail: record.detail,
      })
      mobSources.set(mob, contexts)
    }
  for (const [mob, contexts] of mobSources)
    for (const [index, entry] of lootEntries(
      mob.replace(':', ':entities/'),
      loot,
    ).entries())
      if (known.has(entry.item))
        for (const context of contexts)
          add({
            id: `mob/${mob}/${index}/${context.id}`,
            kind: 'mob-drop',
            inputs: [
              ...(context.gate ? [[context.gate]] : []),
              ['atlas:combat'],
              ...(context.kind === 'structure' ? [['atlas:exploration']] : []),
            ],
            outputs: [entry.item],
            conditions: entry.conditions,
            functions: entry.functions,
            source: entry.table,
            lootTable: mob.replace(':', ':entities/'),
            availability: context,
            sourceKind: context.kind,
            detail: `Potential ${mob} loot. ${context.detail ?? context.reason} Combat, access and conditional drops are required; equipment drops are separate.`,
          })
  for (const id of Object.keys(loot)) {
    let inputs,
      kind,
      contextual = false
    const path = id.split(':')[1]
    if (path?.startsWith('chests/') || environment?.loot.has(id)) {
      inputs = [['atlas:exploration']]
      kind = 'chest-loot'
      contextual = true
      if (id.includes('trial_chambers/reward'))
        inputs.push([
          id.includes('ominous')
            ? 'minecraft:ominous_trial_key'
            : 'minecraft:trial_key',
        ])
    }
    if (path?.startsWith('archaeology/')) {
      inputs = [['atlas:exploration'], ['minecraft:brush']]
      kind = 'archaeology'
      contextual = true
    }
    if (path?.startsWith('spawners/')) {
      inputs = [['atlas:exploration'], ['atlas:combat']]
      kind = 'trial-reward'
      contextual = true
      if (id.includes('ominous')) inputs.push(['minecraft:ominous_bottle'])
    }
    if (id === 'minecraft:gameplay/sniffer_digging') {
      inputs = [['minecraft:sniffer_egg']]
      kind = 'sniffer-digging'
    }
    if (id === 'minecraft:gameplay/cat_morning_gift') {
      inputs = [['atlas:overworld'], ['minecraft:cod', 'minecraft:salmon']]
      kind = 'cat-gift'
    }
    if (id === 'minecraft:gameplay/fishing') {
      inputs = [['minecraft:fishing_rod'], ['atlas:overworld']]
      kind = 'fishing'
    }
    if (id === 'minecraft:gameplay/piglin_bartering') {
      inputs = [['atlas:nether'], ['minecraft:gold_ingot']]
      kind = 'bartering'
    }
    if (!inputs) continue
    const contexts = contextual ? lootContexts(id) : [null]
    for (const [index, entry] of lootEntries(id, loot).entries())
      if (known.has(entry.item))
        for (const context of contexts)
          add({
            id: `loot/${id}/${index}${context ? '/' + context.id : ''}`,
            kind,
            inputs: [...inputs, ...(context?.gate ? [[context.gate]] : [])],
            outputs: [entry.item],
            conditions: entry.conditions,
            functions: entry.functions,
            source: entry.table,
            lootTable: id,
            availability: context ?? undefined,
            detail: `Potential loot. ${context?.reason ?? 'Event prerequisites apply.'} Weights, conditions, placement and unopened containers remain constraints; no guaranteed yield.`,
          })
  }
  for (const [index, modifier] of lootModifiers.entries()) {
    if (
      modifier.type !== 'travelersbackpack:add_item' ||
      !known.has(modifier.item)
    )
      continue
    const table = modifier.conditions?.find(
      (c) => c.condition === 'neoforge:loot_table_id',
    )?.loot_table_id
    if (!table?.startsWith('minecraft:chests/')) continue
    for (const context of lootContexts(table))
      add({
        id: `loot-modifier/${index}/${context.id}`,
        kind: 'loot-modifier',
        inputs: [
          ...(context.gate ? [[context.gate]] : []),
          ['atlas:exploration'],
        ],
        outputs: [modifier.item],
        conditions: modifier.conditions,
        source: modifier,
        availability: context,
        detail:
          'Runtime global loot modifier adds a chance-based item to this chest table. It runs after the base loot table; structure access, configuration and selection probability apply.',
      })
  }
  for (const [index, recipe] of blockRecipes.entries()) {
    const inputs = [],
      type = recipe.type
    if (type === 'createbigcannons:cannon_casting') {
      const fluid = recipe.fluid.fluid
        ? [fluidNode(recipe.fluid.fluid)]
        : (fluidTags[recipe.fluid.tag] ?? []).map(fluidNode)
      const mould = recipe.cast_shape + '_cast_mould'
      inputs.push(fluid, known.has(mould) ? [mould] : [], ['minecraft:sand'])
    } else if (type === 'createbigcannons:drill_boring') {
      inputs.push(
        recipe.input.block ? [recipe.input.block] : [],
        ['createbigcannons:cannon_drill'],
        ['create:mechanical_bearing'],
        ['atlas:rotation'],
        [fluidNode('minecraft:water')],
      )
    } else if (type === 'createbigcannons:built_up_heating') {
      for (const layer of recipe.layers)
        inputs.push(layer.block ? [layer.block] : [])
      inputs.push(
        ['createbigcannons:cannon_builder'],
        ['create:encased_fan'],
        ['atlas:rotation'],
        [fluidNode('minecraft:lava')],
      )
    } else continue
    add({
      id: `block-process/${index}/${recipe.result}`,
      kind: 'block-process',
      inputs,
      outputs: [recipe.result],
      source: recipe,
      detail:
        'Runtime Big Cannons block recipe and bundled Ponder requirements. Cast volume, cooling time, matched drill/lathe speed, layer placement and stress remain operational constraints.',
    })
  }
  for (const [index, recipe] of chiseling.entries()) {
    const variants = recipe.entries
      .flatMap((e) => e.variants)
      .filter((v) => known.has(v.id) && v.worth > 0)
    add({
      id: `chiseling/${index}`,
      kind: 'chiseling',
      inputs: [variants.map((v) => v.id), ['rechiseled:chisel']],
      outputs: variants.map((v) => v.id),
      variants,
      source: recipe.entries.map((e) => e.recipe),
      detail:
        'Runtime Rechiseled group, including plugins. Material worth is conserved; slabs may require multiple inputs. Tool is reusable.',
    })
  }
  for (const [index, transfer] of potionFluids.entries()) {
    const state = potionNode(transfer.item),
      fluid = fluidState(transfer.fluid)
    add({
      id: `potion/drain/${index}`,
      kind: 'potion-fluid',
      inputs: [[state], ['create:item_drain']],
      outputs: [fluid],
      source: transfer,
      detail:
        'Create PotionFluidHandler runtime result. Draining retains potion and bottle-type components; inspect source for volume.',
    })
    add({
      id: `potion/fill/${index}`,
      kind: 'potion-fluid',
      inputs: [[fluid], ['minecraft:glass_bottle'], ['create:spout']],
      outputs: [state, transfer.item.id],
      source: transfer,
      detail:
        'Create potion fluid bottled through a spout. Potion type and bottle form are preserved.',
    })
  }
  const fluidIds = new Set(fluids.map((f) => f.id))
  for (const f of fluids)
    if (
      f.bucket !== 'minecraft:air' &&
      known.has(f.bucket) &&
      !f.id.includes('flowing_')
    ) {
      add({
        id: `fluid/unbucket/${f.id}`,
        kind: 'fluid',
        inputs: [[f.bucket]],
        outputs: [fluidNode(f.id)],
        detail:
          'Available fluid from a filled bucket; transport/automation depends on machinery.',
      })
      add({
        id: `fluid/bucket/${f.id}`,
        kind: 'fluid',
        inputs: [[fluidNode(f.id)], ['minecraft:bucket']],
        outputs: [f.bucket],
        detail:
          'Collect source fluid in a bucket; flowing fluid alone is insufficient.',
      })
    }
  for (const [index, b] of brewing.entries()) {
    const output = potionNode(b.output)
    add({
      id: `brewing/${index}`,
      kind: 'brewing',
      inputs: [
        [potionNode(b.input)],
        [b.ingredient.id],
        ['minecraft:brewing_stand'],
        ['minecraft:blaze_powder'],
      ],
      outputs: [output, b.output.id],
      source: b,
      detail:
        'Runtime brewing probe. Potion components remain distinct graph states. Stand fuel is required.',
    })
  }
  for (const [index, t] of trades.entries()) {
    const o = t.offer,
      inputs = [['atlas:villagers'], [o.buy.id]]
    if (o.buyB?.id) inputs.push([o.buyB.id])
    if (known.has(o.sell.id))
      add({
        id: `trade/${index}`,
        kind: 'trade',
        inputs,
        outputs: [o.sell.id],
        source: t,
        detail: `Seeded ${t.profession} level ${t.level} offer. Profession, level, restocking, prices and variant selection apply. Samples do not enumerate every possible trade.`,
      })
  }
  return { routes, virtual: [...virtual.values()], fluidIds }
}

/** Exact resolved-input collisions only; overlapping tags need separate review. */
export function craftingConflicts(recipes, tags) {
  const groups = new Map()
  for (const recipe of recipes) {
    const j = recipe.json ?? {}
    if (
      !['minecraft:crafting_shaped', 'minecraft:crafting_shapeless'].includes(
        j.type,
      )
    )
      continue
    let unsupported = false
    const slot = (v) => {
      const resolved = ingredient(v, tags)
      if (!resolved.length || JSON.stringify(v).includes('components'))
        unsupported = true
      return resolved.sort().join('|')
    }
    let key
    if (j.pattern) {
      let rows = j.pattern.filter((row) => row.trim().length)
      const left = Math.min(...rows.map((row) => row.search(/\S/))),
        right = Math.max(...rows.map((row) => row.trimEnd().length))
      rows = rows.map((row) => row.slice(left, right))
      const matrix = rows.map((row) =>
        [...row].map((c) => (c === ' ' ? '' : slot(j.key[c]))),
      )
      const shapes = [
        JSON.stringify(matrix),
        JSON.stringify(matrix.map((r) => [...r].reverse())),
      ].sort()
      key = 'shaped:' + shapes[0]
    } else
      key =
        'shapeless:' + JSON.stringify((j.ingredients ?? []).map(slot).sort())
    if (unsupported) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(recipe)
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      id: g.map((r) => r.id).join(' / '),
      kind:
        new Set(g.map((r) => JSON.stringify(r.json.result))).size > 1
          ? 'output-conflict'
          : 'duplicate',
      recipes: g.map((r) => ({ id: r.id, result: r.json.result })),
      detail:
        'Identical resolved crafting inputs (including mirrored shaped recipes). Polymorph may expose alternatives; this does not prove an unintended conflict.',
    }))
}
