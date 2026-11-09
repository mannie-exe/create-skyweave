import { solveProgression, families } from './progression.mjs'

/** Potential access; unresolved cycles never become roots. */
export function depths(ids, roots, routes) {
  return solveProgression(ids, roots, routes, 'earliest').depth
}

export function recipeOutputs(recipe) {
  const values = recipe.results ?? (recipe.result ? [recipe.result] : [])
  return values
    .map((value) =>
      typeof value === 'string' ? value : (value.id ?? value.item),
    )
    .filter(Boolean)
}

export function recipeInputs(recipe, tags) {
  const resolve = (value) => {
    if (typeof value === 'string')
      return value.startsWith('#') ? (tags[value.slice(1)] ?? []) : [value]
    if (Array.isArray(value)) return value.flatMap(resolve)
    if (value?.item) return [value.item]
    if (value?.tag) return tags[value.tag] ?? []
    return [] // Fluid/custom ingredients remain in full evidence, never guessed.
  }
  return (
    recipe.ingredients ??
    (recipe.ingredient ? [recipe.ingredient] : Object.values(recipe.key ?? {}))
  ).map(resolve)
}

export function layout(nodes) {
  const maximum = Math.max(0, ...nodes.map((n) => n.depth ?? 0))
  const minimum = Math.min(
    ...nodes.filter((n) => n.depth != null).map((n) => n.depth),
    maximum,
  )
  const familyKeys = Object.keys(families)
  let y = 0
  for (const family of familyKeys) {
    const group = nodes.filter(
      (n) =>
        (n.family ?? (n.depth == null ? 'unresolved' : 'production')) ===
        family,
    )
    const stages = new Map()
    for (const node of group) {
      const stage = node.depth ?? maximum + 2
      if (!stages.has(stage)) stages.set(stage, [])
      stages.get(stage).push(node)
    }
    let rows = 0
    for (const [stage, items] of stages) {
      items.sort(
        (a, b) => a.mod.localeCompare(b.mod) || a.id.localeCompare(b.id),
      )
      rows = Math.max(rows, Math.ceil(items.length / 6))
      items.forEach((node, i) => {
        node.x = (stage - minimum) * 7 + (i % 6)
        node.y = y + Math.floor(i / 6)
        node.family = family
      })
    }
    if (rows) y += rows + 1
  }
  return nodes
}

export function detailBucket(id) {
  return [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 16
}

/** Policy-selected witnesses and actionable gaps. No cycle becomes a root. */
export function analyzeRoutes(
  ids,
  roots,
  routes,
  excluded = [],
  policy = 'earliest',
) {
  const solution = solveProgression(ids, roots, routes, policy)
  const { depth, witnesses, pathFor, labels } = solution
  const excludedSet = new Set(excluded)
  const producing = new Map(),
    consumers = new Map()
  for (const route of routes) {
    for (const id of route.outputs) {
      if (!producing.has(id)) producing.set(id, [])
      producing.get(id).push(route)
    }
    for (const id of new Set(route.inputs.flat())) {
      if (!consumers.has(id)) consumers.set(id, new Set())
      consumers.get(id).add(route.id)
    }
  }
  const coverage = new Map(
    ids.map((id) => {
      const producers = producing.get(id) ?? []
      const missing = producers.map((r) => ({
        route: r.id,
        emptyInput: r.inputs.some((g) => !g.length),
        availability: r.availability,
        missing: r.inputs.filter((g) => !g.some((v) => depth.has(v))),
      }))
      const status = excludedSet.has(id)
        ? 'excluded'
        : depth.has(id)
          ? 'mapped'
          : producers.some((r) => r.availability?.state === 'unknown')
            ? 'unknown'
            : producers.some((r) => r.inputs.length)
              ? 'blocked'
              : 'unmapped'
      return [
        id,
        {
          id,
          status,
          depth: depth.get(id) ?? null,
          routeCount: producers.length,
          downstream: consumers.get(id)?.size ?? 0,
          missing: depth.has(id) ? [] : missing,
        },
      ]
    }),
  )
  return { depth, coverage, producing, witnesses, pathFor, labels }
}
