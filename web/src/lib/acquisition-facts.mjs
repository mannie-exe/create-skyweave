import { ingredient } from './acquisition.mjs'
import { routeFamily } from './progression.mjs'

const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const probability = (value) =>
  finite(value) && value >= 0 && value <= 1 ? value : null
const deterministic = new Set([
  'minecraft:crafting_shaped',
  'minecraft:crafting_shapeless',
  'minecraft:smelting',
  'minecraft:blasting',
  'minecraft:smoking',
  'minecraft:campfire_cooking',
  'minecraft:stonecutting',
  'minecraft:smithing_transform',
])
const processing =
  /^create:(crushing|milling|cutting|splashing|haunting|mixing|compacting|pressing|deploying|sandpaper_polishing|mechanical_crafting|filling|emptying)$/
function conditionChance(conditions, assumptions) {
  let chance = 1
  for (const c of conditions ?? []) {
    if (c.condition === 'minecraft:random_chance') {
      const p = probability(c.chance)
      if (p === null) return null
      chance *= p
    } else if (c.condition === 'minecraft:random_chance_with_enchanted_bonus') {
      const p = probability(c.unenchanted_chance)
      if (p === null) return null
      chance *= p
      assumptions.add('No Looting or other enchantment bonus')
    } else if (c.condition === 'minecraft:killed_by_player') {
      assumptions.add('Killed by a player')
    } else return null
  }
  return chance
}
function rolls(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 128) return [value]
  if (
    value?.type === 'minecraft:uniform' &&
    Number.isInteger(value.min) &&
    Number.isInteger(value.max) &&
    value.min >= 0 &&
    value.max <= 128 &&
    value.max >= value.min
  )
    return Array.from(
      { length: value.max - value.min + 1 },
      (_, i) => value.min + i,
    )
  return null
}
// Exact only for simple weighted item/empty pools. Preserve unsupported nested
// tables, predicates and functions as unknown instead of flattening their odds.
export function lootOutcome(table, target) {
  const assumptions = new Set(['Eligible source found; no luck bonus'])
  let miss = 1,
    expected = 0
  if (!table?.pools?.length || table.functions?.length)
    return { probability: null, unit: 'eligible loot event' }
  for (const pool of table.pools) {
    const n = rolls(pool.rolls),
      activation = conditionChance(pool.conditions, assumptions)
    if (
      !n ||
      activation === null ||
      pool.functions?.length ||
      (pool.bonus_rolls && pool.bonus_rolls !== 0)
    )
      return { probability: null, unit: 'eligible loot event' }
    let total = 0,
      hit = 0,
      amount = 0
    for (const e of pool.entries ?? []) {
      if (
        !['minecraft:item', 'minecraft:empty'].includes(e.type) ||
        e.conditions?.length ||
        (e.quality ?? 0) !== 0
      )
        return { probability: null, unit: 'eligible loot event' }
      const weight = e.weight ?? 1
      if (!finite(weight) || weight < 0)
        return { probability: null, unit: 'eligible loot event' }
      total += weight
      if (e.name !== target) continue
      let count = 1
      for (const f of e.functions ?? []) {
        if (
          f.function !== 'minecraft:set_count' ||
          f.conditions?.length ||
          f.add ||
          !Number.isInteger(f.count) ||
          f.count < 0
        )
          return { probability: null, unit: 'eligible loot event' }
        count = f.count
      }
      if (count > 0) hit += weight
      amount += weight * count
    }
    const p = total ? hit / total : 0
    miss *=
      1 -
      activation * (1 - n.reduce((sum, r) => sum + (1 - p) ** r, 0) / n.length)
    expected +=
      activation *
      (n.reduce((sum, r) => sum + r, 0) / n.length) *
      (total ? amount / total : 0)
  }
  return {
    probability: 1 - miss,
    expectedCount: expected,
    unit: 'eligible loot event',
    assumptions: [...assumptions],
  }
}
function recipeFacts(recipe, route, tags, fluidTags) {
  const j = recipe.json ?? {},
    type = j.type ?? recipe.type
  const quantities = []
  const add = (v, amount = 1) => {
    quantities.push({
      alternatives: ingredient(v, tags, fluidTags),
      amount: (v?.amount ?? v?.count ?? 1) * amount,
      unit: v?.amount !== undefined ? 'mB' : 'items',
      role: 'consumed',
    })
  }
  if (j.pattern && j.key)
    for (const row of j.pattern)
      for (const char of row) {
        if (j.key[char]) add(j.key[char])
      }
  else if (j.ingredients) j.ingredients.forEach((v) => add(v))
  else if (j.ingredient) add(j.ingredient)
  else if (j.base)
    [j.template, j.base, j.addition].filter(Boolean).forEach((v) => add(v))
  if (type === 'create:sequenced_assembly')
    for (const step of j.sequence ?? [])
      for (const v of (step.ingredients ?? []).slice(1)) add(v, j.loops ?? 1)
  const consumedIds = new Set(quantities.flatMap((q) => q.alternatives))
  const setup = route.inputs.filter((g) => !g.some((id) => consumedIds.has(id)))
  // A deployer can retain a held tool. Its consumption is not inferred here.
  if (type === 'create:deploying' || j.sequence?.some((s) => s.keepHeldItem))
    quantities.forEach((q) => {
      q.role = 'unresolved consumption'
    })
  const declared = j.results ?? (j.result ? [j.result] : [])
  const weighted = type === 'create:sequenced_assembly'
  const weightSum = declared.reduce((sum, o) => sum + (o.chance ?? 1), 0)
  const outcomes = {}
  for (const id of route.outputs) {
    const matching = declared.filter(
      (o) => (typeof o === 'string' ? o : (o.id ?? o.item)) === id,
    )
    let p = null,
      expectedCount = null
    if (
      matching.length &&
      (weighted || processing.test(type) || deterministic.has(type))
    ) {
      if (weighted) {
        p = probability(
          matching.reduce((sum, o) => sum + (o.chance ?? 1), 0) / weightSum,
        )
        expectedCount = matching.reduce(
          (sum, o) => sum + ((o.count ?? 1) * (o.chance ?? 1)) / weightSum,
          0,
        )
      } else {
        const ps = matching.map((o) => probability(o.chance ?? 1))
        if (ps.every((v) => v !== null)) {
          p = 1 - ps.reduce((m, v) => m * (1 - v), 1)
          expectedCount = matching.reduce(
            (sum, o, i) => sum + (o.count ?? 1) * ps[i],
            0,
          )
        }
      }
    }
    outcomes[id] = {
      probability: p,
      expectedCount,
      unit: weighted
        ? `completed ${j.loops ?? 1}-loop sequence`
        : 'recipe execution',
      mode: weighted ? 'weighted alternative' : 'output',
      assumptions: ['Recipe inputs and operating conditions satisfied'],
    }
  }
  const grouped = new Map()
  for (const q of quantities) {
    const key = JSON.stringify([q.alternatives, q.unit, q.role])
    if (grouped.has(key)) grouped.get(key).amount += q.amount
    else grouped.set(key, { ...q })
  }
  return { quantities: [...grouped.values()], setup, outcomes }
}
export function enrichRoutes(routes, recipes, loot, tags = {}, fluidTags = {}) {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const cache = new Map()
  for (const route of routes) {
    const recipe = byId.get(route.id)
    const family = routeFamily(route)
    const facts = {
      family,
      opportunistic:
        family === 'exploration' ||
        route.kind === 'trade' ||
        route.sourceKind === 'structure',
      quantities: [],
      setup: [],
      outcomes: {},
    }
    if (recipe)
      Object.assign(facts, recipeFacts(recipe, route, tags, fluidTags))
    else
      for (const output of route.outputs) {
        const mining = ['gathering', 'block-drop'].includes(route.kind)
        const rootTable =
          route.lootTable ??
          (route.id.startsWith('loot/')
            ? route.id.slice(5, route.id.lastIndexOf('/'))
            : route.kind === 'mob-drop'
              ? route.id
                  .slice(4, route.id.lastIndexOf('/'))
                  .replace(':', ':entities/')
              : route.source)
        const tableId =
          typeof rootTable === 'string' && loot[rootTable]
            ? rootTable
            : route.source
        const silk = route.inputs.flat().includes('atlas:silk_touch')
        const key = JSON.stringify([tableId, output, mining, silk])
        if (typeof tableId === 'string' && loot[tableId]) {
          if (!cache.has(key))
            cache.set(
              key,
              lootOutcome(
                mining ? miningTable(loot[tableId], silk) : loot[tableId],
                output,
              ),
            )
          facts.outcomes[output] = {
            ...cache.get(key),
            ...(mining
              ? {
                  assumptions: [
                    ...(cache.get(key).assumptions ?? []),
                    `${silk ? 'Silk Touch' : 'No Silk Touch'}; correct mining tool, no Fortune, no explosion`,
                  ],
                }
              : {}),
          }
        } else facts.outcomes[output] = { probability: null, unit: 'operation' }
      }
    if (route.kind === 'trade' && route.source?.offer) {
      const { offer, profession, level } = route.source
      facts.access =
        'Sampled offer; profession, level and availability are not traced as unlocks'
      facts.quantities = [offer.buy, offer.buyB].filter(Boolean).map((v) => ({
        alternatives: [v.id],
        amount: v.count ?? null,
        unit: 'items',
        role: 'consumed',
      }))
      facts.outcomes[offer.sell.id] = {
        probability: 1,
        expectedCount: offer.sell.count ?? null,
        unit: 'trade',
        assumptions: [
          `Existing ${profession} level ${level} offer; stock and payment available`,
        ],
      }
    }
    const trial = {
      gathering: 'eligible block break',
      'block-drop': 'eligible block break',
      'mob-drop': 'eligible mob kill',
      'chest-loot': 'eligible chest',
      fishing: 'eligible fishing catch',
      bartering: 'barter',
      archaeology: 'eligible brush event',
    }[route.kind]
    if (trial)
      for (const outcome of Object.values(facts.outcomes)) outcome.unit = trial
    if (route.kind === 'gathering')
      facts.access =
        'Surveyed or authored source; location, ownership and natural origin are not established by graph reachability'
    facts.supply =
      family === 'exploration'
        ? 'Find another eligible source'
        : recipe
          ? 'Repeat with inputs and working setup'
          : route.kind === 'trade'
            ? 'Offer availability and restocking required'
            : 'Renewability not established'
    route.facts = facts
  }
  return routes
}
export function outcomeLabel(outcome) {
  if (outcome?.probability == null) return 'Chance not calculated'
  const p = outcome.probability
  return `${(p * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}% per ${outcome.unit}`
}

// Evaluate only the ordinary mining context already required by gathering edges.
// Unknown block-state, entity and custom predicates remain unsupported.
function miningTable(table, silk) {
  const evaluate = (c) => {
    if (c.condition === 'minecraft:survives_explosion') return true
    if (
      c.condition === 'minecraft:match_tool' &&
      Object.keys(c.predicate ?? {}).length === 1
    ) {
      const predicates = c.predicate.predicates
      const enchants = predicates?.['minecraft:enchantments']
      if (
        Object.keys(predicates ?? {}).length === 1 &&
        enchants?.length === 1 &&
        enchants[0].enchantments === 'minecraft:silk_touch' &&
        Object.keys(enchants[0]).length === 2 &&
        enchants[0].levels?.min === 1 &&
        Object.keys(enchants[0].levels).length === 1
      )
        return silk
    }
    if (c.condition === 'minecraft:inverted') {
      const value = evaluate(c.term)
      return value == null ? null : !value
    }
    if (c.condition === 'minecraft:all_of') {
      const values = c.terms.map(evaluate)
      return values.includes(false)
        ? false
        : values.every((v) => v === true)
          ? true
          : null
    }
    return null
  }
  const clean = (obj) => {
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(clean)
    const next = Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, clean(value)]),
    )
    if (obj.conditions) {
      if (obj.conditions.some((c) => evaluate(c) === false))
        return {
          type: 'minecraft:empty',
          weight: obj.weight ?? 1,
          conditions: [{ condition: 'atlas:never' }],
        }
      next.conditions = obj.conditions.filter((c) => evaluate(c) !== true)
    }
    if (obj.functions)
      next.functions = obj.functions
        .filter((f) =>
          !f.conditions?.length && f.function === 'minecraft:explosion_decay'
            ? false
            : !(
                f.function === 'minecraft:apply_bonus' &&
                f.enchantment === 'minecraft:fortune' &&
                f.formula === 'minecraft:ore_drops' &&
                !f.conditions?.length
              ),
        )
        .map(clean)
    if (obj.type === 'minecraft:alternatives') {
      for (const child of next.children) {
        if (child.conditions?.some((c) => c.condition === 'atlas:never'))
          continue
        if (child.conditions?.length) return next
        return {
          ...child,
          conditions: [...(next.conditions ?? []), ...(child.conditions ?? [])],
          functions: [...(next.functions ?? []), ...(child.functions ?? [])],
        }
      }
    }
    return next
  }
  return clean(table)
}
