import {
  solveProgression,
  routeCandidate,
  compareLabels,
} from './progression.mjs'

export function methodMetrics(itemId, routes, roots) {
  const ids = [
    ...new Set([
      ...roots,
      ...routes.flatMap((r) => [...r.inputs.flat(), ...r.outputs]),
    ]),
  ]
  const available = routes.filter(
    (r) =>
      !r.outputs.includes(itemId) ||
      r.facts?.outcomes?.[itemId]?.probability === 0,
  )
  const independentRoots = roots.filter((id) => id !== itemId)
  const baseline = solveProgression(ids, roots, routes)
  const independent = solveProgression(ids, independentRoots, available)
  const earliest = solveProgression(
    ids,
    independentRoots,
    available,
    'earliest',
  )
  return new Map(
    routes
      .filter((r) => r.outputs.includes(itemId))
      .map((route) => {
        const planned = routeCandidate(route, itemId, independent.labels)
        const possible = routeCandidate(
          route,
          itemId,
          earliest.labels,
          'earliest',
        )
        const full = routeCandidate(route, itemId, baseline.labels)
        return [
          route.id,
          {
            depth: planned?.depth ?? null,
            earliestDepth: possible?.depth ?? null,
            mappedDepth: full?.depth ?? null,
            planned,
            earliest: possible,
            outcome: route.facts?.outcomes?.[itemId] ?? null,
            availability: route.availability,
            status:
              route.availability?.state === 'blocked'
                ? 'blocked'
                : route.availability?.state === 'unknown'
                  ? 'unknown'
                  : planned
                    ? 'ranked'
                    : full
                      ? 'target-dependent'
                      : 'unresolved',
            inputCount: route.inputs.length,
            prerequisites: route.inputs.map((group, i) => ({
              id: planned?.inputs[i] ?? null,
              depth: planned ? independent.depth.get(planned.inputs[i]) : null,
              alternatives: group,
            })),
          },
        ]
      }),
  )
}

export function compareMethods(
  methods,
  { query = '', type = '', sort = 'fewest', tracing = '', role = '' } = {},
) {
  const visible = methods.filter(
    (m) =>
      `${m.label} ${m.group} ${m.type} ${m.id}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!type || m.type === type) &&
      (!tracing || m.metrics.status === tracing) &&
      (!role ||
        (role === 'secondary'
          ? m.secondary
          : role === 'conversion'
            ? m.conversion
            : !m.secondary && !m.conversion)),
  )
  return visible.sort((a, b) => {
    if (sort === 'type')
      return (
        a.type.localeCompare(b.type) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id)
      )
    // Compare first-supply and existing-supply routes separately. Unknown depth
    // is not infinity and must never masquerade as the hardest method.
    const order = {
      ranked: 0,
      'target-dependent': 1,
      unresolved: 2,
      unknown: 3,
      blocked: 4,
    }
    const status = order[a.metrics.status] - order[b.metrics.status]
    if (status) return status
    if (sort === 'planned') {
      const difference = compareLabels(a.metrics.planned, b.metrics.planned)
      if (difference) return difference
    }
    if (sort === 'chance') {
      const aOutcome = a.metrics.outcome,
        bOutcome = b.metrics.outcome
      const unit = (aOutcome?.unit ?? 'Unknown trial').localeCompare(
        bOutcome?.unit ?? 'Unknown trial',
      )
      if (unit) return unit
      const ap = aOutcome?.probability,
        bp = bOutcome?.probability
      if (ap == null && bp != null) return 1
      if (bp == null && ap != null) return -1
      if (ap != null && bp != null && ap !== bp) return bp - ap
    }
    const aDepth =
      a.metrics.earliestDepth ?? a.metrics.depth ?? a.metrics.mappedDepth
    const bDepth =
      b.metrics.earliestDepth ?? b.metrics.depth ?? b.metrics.mappedDepth
    if (aDepth !== null && bDepth !== null) {
      const delta = aDepth - bDepth
      if (delta) return sort === 'most' ? -delta : delta
    }
    return a.label.localeCompare(b.label) || a.id.localeCompare(b.id)
  })
}

export const methodTraceLabels = {
  ranked: 'Traced without this item',
  'target-dependent': 'Depends on existing supply',
  unresolved: 'Unresolved prerequisites',
  unknown: 'Source not classified',
  blocked: 'Unavailable in this environment',
}

/** A manual choice wins; otherwise follow the same solved witness as the graph. */
export function defaultMethod(
  methods,
  detail,
  itemId,
  policy = 'planned',
  preferred,
) {
  if (preferred && methods.some((method) => method.id === preferred))
    return preferred
  const witness = (
    policy === 'earliest' ? detail.earliestPath : detail.path
  )?.find((step) => step.id === itemId)?.route
  if (methods.some((method) => method.id === witness)) return witness
  const ranked = [...methods]
    .filter((method) => method.metrics?.status === 'ranked')
    .sort(
      (a, b) =>
        compareLabels(
          policy === 'earliest' ? a.metrics.earliest : a.metrics.planned,
          policy === 'earliest' ? b.metrics.earliest : b.metrics.planned,
          policy,
        ) || a.id.localeCompare(b.id),
    )
  return (
    ranked[0]?.id ?? compareMethods(methods, { sort: 'planned' })[0]?.id ?? ''
  )
}
