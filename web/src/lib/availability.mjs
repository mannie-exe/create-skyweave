// One declared-source policy for compilation, solving and method views. A potential
// source is conditional generation evidence, never a placed resource or yield.
const idPattern = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
const sorted = (values) => [...new Set(values)].sort()
export function validateEnvironmentPolicy(policy) {
  if (!object(policy) || !['dedicated', 'integrated'].includes(policy.context))
    throw new Error('environment needs a dedicated or integrated context')
  if (policy.preset !== undefined && !idPattern.test(policy.preset))
    throw new Error('Invalid environment preset')
  if (!Array.isArray(policy.dimensions) || !policy.dimensions.length)
    throw new Error('environment needs dimension bindings')
  if (
    Object.keys(policy).some(
      (key) =>
        !['context', 'preset', 'dimensions', 'lootBindings'].includes(key),
    )
  )
    throw new Error('Unknown environment policy field')
  const ids = new Set(),
    gates = new Set()
  for (const row of policy.dimensions) {
    if (
      !object(row) ||
      !idPattern.test(row.id) ||
      !idPattern.test(row.gate) ||
      ids.has(row.id) ||
      gates.has(row.gate) ||
      !['initial', 'conditional'].includes(row.access)
    )
      throw new Error('Invalid or duplicate dimension binding')
    if (
      Object.keys(row).some(
        (key) =>
          !['id', 'gate', 'access', 'denyFeature', 'markedSetting'].includes(
            key,
          ),
      )
    )
      throw new Error('Unknown dimension binding field')
    if (
      (row.denyFeature !== undefined || row.markedSetting !== undefined) &&
      (typeof row.denyFeature !== 'string' ||
        !row.denyFeature.trim() ||
        !idPattern.test(row.markedSetting))
    )
      throw new Error(
        'A dimension feature restriction needs its marked setting',
      )
    ids.add(row.id)
    gates.add(row.gate)
  }
  for (const binding of policy.lootBindings ?? []) {
    if (
      object(binding) &&
      Object.keys(binding).some(
        (key) =>
          ![
            'tables',
            'structures',
            'dimensions',
            'features',
            'evidence',
          ].includes(key),
      )
    )
      throw new Error('Unknown loot binding field')
    if (
      !object(binding) ||
      !Array.isArray(binding.tables) ||
      !binding.tables.length ||
      binding.tables.some((id) => !idPattern.test(id)) ||
      typeof binding.evidence !== 'string' ||
      !binding.evidence.trim()
    )
      throw new Error('Loot bindings need table IDs and evidence')
    for (const key of ['structures', 'dimensions', 'features'])
      if (
        binding[key] !== undefined &&
        (!Array.isArray(binding[key]) ||
          !binding[key].length ||
          binding[key].some((id) => !idPattern.test(id)))
      )
        throw new Error('Invalid loot source binding')
    if (
      ['structures', 'dimensions', 'features'].filter(
        (key) => binding[key] !== undefined,
      ).length !== 1
    )
      throw new Error('Each loot binding needs exactly one source kind')
  }
  return policy
}
const state = (status, reason, fields = {}) => ({
  state: status,
  reason,
  ...fields,
})
export function sourceUsable(availability) {
  return (
    !availability || ['potential', 'available'].includes(availability.state)
  )
}
export function filterRoots(roots, gates = {}) {
  return roots.filter((id) => !gates[id] || sourceUsable(gates[id]))
}
function combineSources(
  sources,
  missing = 'Source generation is not classified',
) {
  const usable = sources.filter(sourceUsable)
  const selected = usable.length
    ? usable
    : sources.filter((source) => source.state === 'unknown')
  const result = selected.length ? selected : sources
  return state(
    usable.length
      ? 'potential'
      : selected.length || !sources.length
        ? 'unknown'
        : 'blocked',
    sorted(result.map((source) => source.reason).filter(Boolean)).join('; ') ||
      missing,
    { evidence: result.map((source) => ({ ...source })) },
  )
}
const resource = (resources, kind, id) =>
  resources[id.replace(':', ':' + kind + '/') + '.json']?.json
const namedStates = (value) =>
  idPattern.test(value?.Name ?? '') ? [value.Name] : []
function providerBlocks(value, depth = 0) {
  if (!object(value) || depth > 64) return []
  switch (value.type) {
    case 'minecraft:simple_state_provider':
    case 'minecraft:rotated_block_provider':
      return namedStates(value.state)
    case 'minecraft:weighted_state_provider':
      return (value.entries ?? [])
        .filter((entry) => entry.weight > 0)
        .flatMap((entry) => namedStates(entry.data))
    case 'minecraft:randomized_int_state_provider':
      return providerBlocks(value.source, depth + 1)
    case 'minecraft:noise_provider':
    case 'minecraft:dual_noise_provider':
      return (value.states ?? []).flatMap(namedStates)
    case 'minecraft:noise_threshold_provider':
      return [
        ...namedStates(value.default_state),
        ...(value.low_states ?? []).flatMap(namedStates),
        ...(value.high_states ?? []).flatMap(namedStates),
      ]
    default:
      return []
  }
}
// Read output-state paths only. Ore target predicates and replacement inputs are
// deliberately excluded; unknown feature/provider implementations stay unknown.
function featureBlocks(
  capture,
  value,
  seen = new Set(),
  depth = 0,
  registry = 'placedFeatures',
) {
  if (depth > 64) return []
  if (typeof value === 'string') {
    const key = registry + '/' + value
    if (seen.has(key)) return []
    return featureBlocks(
      capture,
      capture[registry]?.[value],
      new Set([...seen, key]),
      depth + 1,
      registry,
    )
  }
  if (!object(value)) return []
  if (value.feature && !value.type)
    return featureBlocks(
      capture,
      value.feature,
      seen,
      depth + 1,
      'configuredFeatures',
    )
  const config = value.config ?? {},
    type = value.type
  if (
    [
      'minecraft:ore',
      'minecraft:scattered_ore',
      'minecraft:replace_single_block',
    ].includes(type)
  )
    return config.size === 0
      ? []
      : (config.targets ?? []).flatMap((target) => namedStates(target.state))
  if (type === 'minecraft:tree')
    return ['trunk_provider', 'foliage_provider', 'dirt_provider'].flatMap(
      (key) => providerBlocks(config[key]),
    )
  if (['minecraft:simple_block', 'minecraft:block_pile'].includes(type))
    return providerBlocks(config.to_place ?? config.state_provider)
  if (type === 'minecraft:disk')
    return [
      ...providerBlocks(config.state_provider?.fallback),
      ...(config.state_provider?.rules ?? []).flatMap((rule) =>
        providerBlocks(rule.then),
      ),
    ]
  if (type === 'minecraft:spring_feature') return namedStates(config.state)
  if (type === 'minecraft:lake')
    return [...providerBlocks(config.fluid), ...providerBlocks(config.barrier)]
  if (
    [
      'minecraft:random_patch',
      'minecraft:flower',
      'minecraft:no_bonemeal_flower',
    ].includes(type)
  )
    return featureBlocks(capture, config.feature, seen, depth + 1)
  if (type === 'minecraft:simple_random_selector')
    return (
      Array.isArray(config.features)
        ? config.features
        : config.features
          ? [config.features]
          : []
    ).flatMap((feature) => featureBlocks(capture, feature, seen, depth + 1))
  if (type === 'minecraft:random_boolean_selector')
    return [config.feature_true, config.feature_false].flatMap((feature) =>
      featureBlocks(capture, feature, seen, depth + 1),
    )
  if (type === 'minecraft:random_selector') {
    const blocks = []
    let fallback = true
    for (const choice of config.features ?? []) {
      if (choice.chance > 0)
        blocks.push(...featureBlocks(capture, choice.feature, seen, depth + 1))
      if (choice.chance >= 1) {
        fallback = false
        break
      }
    }
    return fallback
      ? [...blocks, ...featureBlocks(capture, config.default, seen, depth + 1)]
      : blocks
  }
  return []
}
function surfaceBlocks(rule) {
  if (!object(rule)) return []
  if (rule.type === 'minecraft:block') return namedStates(rule.result_state)
  return [
    ...(rule.sequence ?? []).flatMap(surfaceBlocks),
    ...surfaceBlocks(rule.then_run),
  ]
}
function templateBranches(capture, resources, structure) {
  const definition = structure.definition ?? {},
    root = definition.start_pool
  if (typeof root !== 'string') return []
  const maximum = definition.size ?? definition.max_depth ?? definition.maxDepth
  // The branch inventory is declaration evidence, not a second jigsaw assembler.
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > 64) return []
  const templates = new Set(),
    visited = new Map(),
    queue = [[root, 0]]
  function element(value, depth) {
    if (!object(value)) return
    if (value.element_type === 'minecraft:list_pool_element') {
      for (const part of value.elements ?? []) element(part, depth)
      return
    }
    if (
      ![
        'minecraft:single_pool_element',
        'minecraft:legacy_single_pool_element',
      ].includes(value.element_type) ||
      typeof value.location !== 'string'
    )
      return
    const facts = capture.templates?.[value.location]
    if (!facts) return
    templates.add(value.location)
    if (depth < maximum)
      for (const next of facts.pools ?? []) queue.push([next, depth + 1])
  }
  for (let i = 0; i < queue.length; i++) {
    const [id, depth] = queue[i]
    if ((visited.get(id) ?? Infinity) <= depth) continue
    visited.set(id, depth)
    const pool =
      capture.pools?.[id] ?? resource(resources, 'worldgen/template_pool', id)
    if (!pool) continue
    for (const entry of pool.elements ?? [])
      if (entry.weight > 0) element(entry.element, depth)
    if (
      pool.fallback &&
      pool.fallback !== id &&
      pool.fallback !== 'minecraft:empty'
    )
      queue.push([pool.fallback, depth])
  }
  return [...templates].sort()
}
export function buildEnvironment({ capture, policy, resources = {} }) {
  validateEnvironmentPolicy(policy)
  if (capture?.schema !== 1)
    throw new Error(
      'Native environment capture is missing or unsupported; refresh the runtime snapshot',
    )
  const presetId = policy.preset ?? capture.serverDefaults?.levelType
  const preset = capture.presets?.[presetId]
  const dimensions = {},
    gates = {},
    blocks = new Map(),
    mobs = new Map(),
    loot = new Map(),
    featureSources = new Map()
  const marked =
    preset?.dimensions?.['minecraft:overworld']?.generator?.settings
  for (const binding of policy.dimensions) {
    const declared = preset?.dimensions?.[binding.id]
    let available
    if (!preset)
      available = state(
        'unknown',
        'Selected world preset is missing from native declarations',
      )
    else if (!declared)
      available = state(
        'blocked',
        'Dimension is not declared by the selected world preset',
      )
    else if (
      binding.id === 'minecraft:the_nether' &&
      policy.context === 'dedicated' &&
      capture.serverDefaults?.allowNether === false
    )
      available = state(
        'blocked',
        'Nether access is disabled by the server template',
      )
    else if (
      binding.denyFeature &&
      marked === binding.markedSetting &&
      capture.features?.['terrain.preset'] === true
    ) {
      const enabled = capture.features[binding.denyFeature]
      available =
        enabled === true
          ? state(
              'blocked',
              'Nether access is disabled in marked Skyweave worlds',
            )
          : enabled === false
            ? state(
                'potential',
                'Dimension declared; its access prerequisites still apply',
              )
            : state(
                'unknown',
                'The selected Compat build does not report this access policy',
              )
    } else
      available = state(
        'potential',
        'Dimension declared; its access prerequisites still apply',
      )
    if (available.state === 'potential' && !Array.isArray(declared.biomes))
      available = state(
        'unknown',
        declared.unknown ?? 'No supported biome-source declaration',
      )
    const row = {
      ...available,
      id: binding.id,
      gate: binding.gate,
      access: binding.access,
      biomes: declared?.biomes ?? [],
      preset: presetId,
      evidence: 'native preset and effective pack defaults',
    }
    dimensions[binding.id] = row
    gates[binding.gate] = row
  }
  const insert = (map, target, context) => {
    const values = map.get(target) ?? []
    const index = values.findIndex((value) => value.id === context.id)
    if (index >= 0) {
      // One branch can feed several blocks, loot tables and mobs. Merging an
      // output's provenance must not mutate the contexts owned by other outputs.
      const merged = { ...values[index] }
      for (const key of ['biomes', 'features', 'templates'])
        if (context[key])
          merged[key] = sorted([...(merged[key] ?? []), ...context[key]])
      values[index] = merged
    } else values.push({ ...context })
    map.set(target, values)
  }
  const context = (dimension, id, kind, extra = {}) => ({
    ...dimensions[dimension],
    id,
    dimensions: [dimension],
    kind,
    evidence: 'declared potential',
    ...extra,
  })
  const structureSources = new Map()
  for (const [id, structure] of Object.entries(capture.structures ?? {})) {
    const contexts = []
    for (const dimension of Object.values(dimensions)) {
      const overlap =
        structure.biomes?.filter((id) => dimension.biomes.includes(id)) ?? []
      if (!overlap.length && dimension.state !== 'unknown') continue
      const value = context(
        dimension.id,
        'structure/' + id + '/' + dimension.id,
        'structure',
        { structures: [id], biomes: overlap },
      )
      if (!structure.sets?.length)
        Object.assign(
          value,
          state(
            'blocked',
            'Structure has no positive-weight registered structure-set entry',
          ),
        )
      if (
        marked === 'skyweave_compat:islands_v1' &&
        capture.features?.['yungsapi.island_structures'] &&
        structure.suppressedByYung
      )
        Object.assign(
          value,
          state(
            'blocked',
            'Native structure is replaced by its enabled YUNG variant',
          ),
        )
      const rule = capture.structurePolicy?.families?.[structure.family]
      if (
        marked === 'skyweave_compat:islands_v1' &&
        capture.features?.['terrain.structure_distribution'] &&
        rule &&
        (capture.structurePolicy.frequencyMultiplier === 0 ||
          rule.maximumPerCluster === 0 ||
          rule.targetStartsPer1024Chunks === 0)
      )
        Object.assign(
          value,
          state(
            'blocked',
            'Managed structure family is disabled by its effective generation policy',
          ),
        )
      contexts.push(value)
      for (const override of Object.values(
        structure.definition?.spawn_overrides ?? {},
      ))
        for (const spawn of override.spawns ?? [])
          if (spawn.weight > 0) insert(mobs, spawn.type, value)
      for (const name of templateBranches(capture, resources, structure)) {
        const template = capture.templates[name],
          branch = {
            ...value,
            id: value.id + '/templates',
            templates: [name],
            reason:
              value.state === 'potential'
                ? 'Declared template/pool branch; fit, processors, ownership and unopened loot remain conditional'
                : value.reason,
          }
        for (const block of template.blocks ?? []) insert(blocks, block, branch)
        for (const table of template.loot ?? []) insert(loot, table, branch)
        for (const mob of [
          ...(template.entities ?? []),
          ...(template.spawners ?? []),
        ])
          insert(mobs, mob, branch)
      }
    }
    structureSources.set(
      id,
      contexts.length
        ? contexts
        : [
            state(
              'blocked',
              'Structure has no biomes admitted by the selected preset',
              { id: 'structure/' + id, structures: [id] },
            ),
          ],
    )
  }
  for (const dimension of Object.values(dimensions)) {
    const definition = preset?.dimensions?.[dimension.id]?.generator
    const noise =
      typeof definition?.settings === 'string'
        ? resource(resources, 'worldgen/noise_settings', definition.settings)
        : definition?.settings
    const terrain = [
      ...namedStates(noise?.default_block),
      ...surfaceBlocks(noise?.surface_rule),
    ]
    for (const block of sorted(terrain))
      insert(
        blocks,
        block,
        context(dimension.id, 'terrain/' + dimension.id, 'terrain', {
          reason:
            dimension.state === 'potential'
              ? 'Declared base/surface material; geography, tooling and terrain rules still apply'
              : dimension.reason,
        }),
      )
    const featureBiomes = new Map()
    for (const biome of dimension.biomes) {
      const definition = capture.biomes?.[biome]
      for (const mob of definition?.spawns ?? [])
        insert(
          mobs,
          mob,
          context(dimension.id, 'biome/' + dimension.id, 'biome', {
            biomes: [biome],
          }),
        )
      for (const feature of definition?.features ?? []) {
        const biomes = featureBiomes.get(feature) ?? []
        biomes.push(biome)
        featureBiomes.set(feature, biomes)
      }
    }
    for (const [feature, biomes] of featureBiomes) {
      insert(
        featureSources,
        feature,
        context(
          dimension.id,
          'feature/' + dimension.id + '/' + feature,
          'feature',
          { biomes: sorted(biomes), features: [feature] },
        ),
      )
      for (const block of sorted(featureBlocks(capture, feature)))
        insert(
          blocks,
          block,
          context(
            dimension.id,
            'feature/' + dimension.id + '/' + feature,
            'feature',
            {
              biomes: sorted(biomes),
              features: [feature],
              reason:
                dimension.state === 'potential'
                  ? 'Declared feature output in an admitted biome; placement and harvest are conditional'
                  : dimension.reason,
            },
          ),
        )
    }
  }
  for (const binding of policy.lootBindings ?? []) {
    const contexts = [
      ...(binding.structures ?? []).flatMap(
        (id) =>
          structureSources.get(id) ?? [
            state('unknown', 'Unclassified structure: ' + id, {
              id: 'structure/' + id,
            }),
          ],
      ),
      ...(binding.features ?? []).flatMap(
        (id) =>
          featureSources.get(id) ?? [
            state('blocked', 'Feature is not declared in an admitted biome', {
              id: 'feature/' + id,
            }),
          ],
      ),
      ...(binding.dimensions ?? []).map((id) =>
        dimensions[id]
          ? context(id, 'declared-loot/' + id, 'event')
          : state('unknown', 'Bound dimension is not classified'),
      ),
    ]
    for (const table of binding.tables)
      for (const value of contexts)
        insert(loot, table, {
          ...value,
          id: value.id + '/binding/' + table,
          bindingEvidence: binding.evidence,
        })
  }
  function explicit(record) {
    const target = record.environment
    const candidates = [
      ...(target?.dimensions ?? []).map(
        (id) =>
          dimensions[id] ?? state('unknown', 'Unclassified dimension: ' + id),
      ),
      ...(target?.features ?? []).flatMap(
        (id) =>
          featureSources.get(id) ?? [
            state('blocked', 'Feature is not declared in an admitted biome'),
          ],
      ),
      ...(target?.structures ?? []).flatMap(
        (id) =>
          structureSources.get(id) ?? [
            state('unknown', 'Unclassified structure: ' + id),
          ],
      ),
    ]
    const availability = candidates.length
      ? combineSources(candidates)
      : gates[record.gate]
    return availability
      ? {
          ...availability,
          evidence: 'authored source declaration',
          provenance: record.sources ?? [],
        }
      : state('potential', 'Authored acquisition prerequisites apply', {
          evidence: 'authored rule',
          provenance: record.sources ?? [],
        })
  }
  function forGate(gate) {
    return gates[gate]
  }
  function constrain(route) {
    const contexts = []
    if (route.availability) contexts.push(route.availability)
    for (const output of route.outputs)
      if (gates[output]) contexts.push(gates[output])
    for (const group of route.inputs) {
      const candidates = group.map((id) => gates[id])
      if (candidates.length && candidates.every(Boolean))
        contexts.push(combineSources(candidates))
    }
    const denied = contexts.find((value) => value.state === 'blocked'),
      uncertain = contexts.find((value) => value.state === 'unknown')
    if (denied || uncertain) route.availability = denied ?? uncertain
    else if (contexts.length && !route.availability)
      route.availability = combineSources(contexts)
    return route
  }
  return {
    dimensions,
    gates,
    preset: presetId,
    context: policy.context,
    blocks,
    mobs,
    loot,
    structures: structureSources,
    features: featureSources,
    explicit,
    forGate,
    constrain,
    roots: (roots) => filterRoots(roots, gates),
    summary: {
      preset: presetId,
      context: policy.context,
      dimensions,
      errors: capture.errors ?? [],
      limitations: [
        'Declarations are potential sources, not generated quantities or guaranteed placement',
        'Unclassified custom features/events remain unknown; saved-world observations retain their own provenance',
      ],
    },
  }
}
