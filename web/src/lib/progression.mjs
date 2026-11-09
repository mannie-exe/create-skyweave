import { sourceUsable } from './availability.mjs'
// One label per item and policy. This is an access model, not an inventory or
// throughput optimizer. All costs are nonnegative; depth strictly increases.
export const families = {
  gathering: 'Gathering',
  production: 'Crafting & processing',
  trading: 'Trading',
  exploration: 'Exploration & events',
  combat: 'Mob drops',
  interaction: 'Other interactions',
  unresolved: 'No traced route',
}
export function routeFamily(route) {
  if (['gathering', 'fishing', 'sniffer-digging'].includes(route.kind))
    return 'gathering'
  if (
    [
      'recipe',
      'block-process',
      'chiseling',
      'brewing',
      'potion-fluid',
      'fluid',
      'block-drop',
    ].includes(route.kind)
  )
    return 'production'
  if (['trade', 'bartering'].includes(route.kind)) return 'trading'
  if (
    [
      'chest-loot',
      'archaeology',
      'trial-reward',
      'loot-modifier',
      'cat-gift',
    ].includes(route.kind)
  )
    return 'exploration'
  if (route.kind === 'mob-drop') return 'combat'
  return 'interaction'
}
export const policies = {
  planned: 'Planned first access',
  earliest: 'Earliest possible access',
}
export function compareLabels(a, b, policy = 'planned') {
  if (!a) return b ? 1 : 0
  if (!b) return -1
  const keys =
    policy === 'earliest'
      ? ['depth']
      : ['opportunities', 'unknowns', 'random', 'depth']
  for (const key of keys) if (a[key] !== b[key]) return a[key] - b[key]
  return 0
}
function prepare(route) {
  const keys = route.inputs.map((g) => JSON.stringify([...new Set(g)].sort()))
  return {
    route,
    costIndices: keys
      .map((key, i) => (keys.indexOf(key) === i ? i : -1))
      .filter((i) => i >= 0),
  }
}
function prerequisites(prepared, labels, policy) {
  const { route, costIndices } = prepared
  if (!route.inputs.length || route.inputs.some((g) => !g.length)) return null
  const inputs = []
  for (const group of route.inputs) {
    let chosen
    for (const id of group) {
      if (!labels.has(id)) continue
      const comparison =
        chosen === undefined
          ? -1
          : compareLabels(labels.get(id), labels.get(chosen), policy)
      if (comparison < 0 || (comparison === 0 && id < chosen)) chosen = id
    }
    if (chosen === undefined) return null
    inputs.push(chosen)
  }
  // Additive costs preserve ordering during relaxation. Identical direct OR
  // groups count once; shared earlier branches can repeat. These are not budgets.
  const total = (key) =>
    costIndices.reduce((sum, i) => sum + labels.get(inputs[i])[key], 0)
  return {
    inputs,
    depth: Math.max(...inputs.map((id) => labels.get(id).depth)) + 1,
    opportunities: total('opportunities'),
    unknowns: total('unknowns'),
    random: total('random'),
  }
}
function outcomeCandidate(route, output, base) {
  if (!base || !sourceUsable(route.availability)) return null
  const outcome = route.facts?.outcomes?.[output]
  if (outcome?.probability === 0) return null
  return {
    ...base,
    opportunities:
      base.opportunities +
      Number(
        route.facts?.opportunistic ?? routeFamily(route) === 'exploration',
      ),
    unknowns:
      base.unknowns +
      Number(Boolean(route.facts) && outcome?.probability == null),
    random:
      base.random + Number(outcome?.probability > 0 && outcome.probability < 1),
  }
}
export function routeCandidate(route, output, labels, policy = 'planned') {
  return outcomeCandidate(
    route,
    output,
    prerequisites(prepare(route), labels, policy),
  )
}
export function solveProgression(ids, roots, routes, policy = 'planned') {
  const known = new Set(ids)
  const labels = new Map(
    roots
      .filter((id) => known.has(id))
      .map((id) => [
        id,
        { depth: 0, opportunities: 0, unknowns: 0, random: 0 },
      ]),
  )
  const rootSet = new Set(roots),
    witnesses = new Map()
  const ordered = [...routes]
    .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
    .map(prepare)
  const consumers = new Map()
  ordered.forEach((p, i) => {
    for (const id of new Set(p.route.inputs.flat())) {
      if (!consumers.has(id)) consumers.set(id, [])
      consumers.get(id).push(i)
    }
  })
  const queue = [],
    queued = new Set()
  const enqueue = (i) => {
    if (!queued.has(i)) {
      queued.add(i)
      queue.push(i)
    }
  }
  for (const id of labels.keys())
    for (const i of consumers.get(id) ?? []) enqueue(i)
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]
    queued.delete(i)
    const p = ordered[i],
      route = p.route
    const base = prerequisites(p, labels, policy)
    if (!base) continue
    for (const output of route.outputs) {
      if (!known.has(output) || rootSet.has(output)) continue
      const candidate = outcomeCandidate(route, output, base)
      if (!candidate) continue
      const comparison = compareLabels(candidate, labels.get(output), policy)
      const witness = witnesses.get(output)
      if (
        comparison < 0 ||
        (comparison === 0 &&
          route.id &&
          route.id < (witness?.route ?? '\uffff'))
      ) {
        const { inputs, ...label } = candidate
        labels.set(output, label)
        witnesses.set(output, { route: route.id, inputs })
        if (comparison < 0)
          for (const consumer of consumers.get(output) ?? []) enqueue(consumer)
      }
    }
  }
  function pathFor(id) {
    const result = [],
      seen = new Set()
    const visit = (key) => {
      if (seen.has(key)) return
      seen.add(key)
      const witness = witnesses.get(key)
      if (witness) witness.inputs.forEach(visit)
      result.push({
        id: key,
        depth: labels.get(key)?.depth ?? null,
        root: rootSet.has(key),
        ...witness,
      })
    }
    visit(id)
    return result
  }
  return {
    labels,
    depth: new Map([...labels].map(([id, label]) => [id, label.depth])),
    witnesses,
    pathFor,
  }
}
