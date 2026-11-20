// Offline review classifications, never item behavior, availability or a gameplay whitelist.
const selectorKeys = new Set([
  'ids',
  'namespaces',
  'types',
  'blockTypes',
  'typePrefixes',
  'tagPrefixes',
  'blockEntity',
])

function classify(rules, item, blocks = []) {
  if (
    rules.schema !== 1 ||
    !Array.isArray(rules.families) ||
    !Array.isArray(rules.exclusions)
  )
    throw new Error('Unsupported equipment review definitions')
  const types = new Set(item.types ?? [])
  const blockTypes = new Set(blocks.flatMap((block) => block.types ?? []))
  if (!Array.isArray(item.types))
    throw new Error(
      'Refresh the native registry capture: item type evidence is missing',
    )
  const matches = (selector) => {
    if (
      !Object.keys(selector).length ||
      Object.keys(selector).some((key) => !selectorKeys.has(key))
    )
      throw new Error('Unknown or empty equipment selector')
    if (
      selector.blockEntity !== undefined &&
      typeof selector.blockEntity !== 'boolean'
    )
      throw new Error('Equipment block-entity selector requires a boolean')
    for (const key of [
      'ids',
      'namespaces',
      'types',
      'blockTypes',
      'typePrefixes',
      'tagPrefixes',
    ])
      if (
        selector[key] !== undefined &&
        (!Array.isArray(selector[key]) ||
          selector[key].some((value) => typeof value !== 'string'))
      )
        throw new Error('Equipment selector requires string lists')
    return (
      (!selector.ids || selector.ids.includes(item.id)) &&
      (!selector.namespaces ||
        selector.namespaces.includes(item.id.split(':')[0])) &&
      (!selector.types || selector.types.some((type) => types.has(type))) &&
      (!selector.blockTypes ||
        selector.blockTypes.some((type) => blockTypes.has(type))) &&
      (!selector.typePrefixes ||
        selector.typePrefixes.some((prefix) =>
          [...types].some((type) => type.startsWith(prefix)),
        )) &&
      (!selector.tagPrefixes ||
        selector.tagPrefixes.some((prefix) =>
          (item.tags ?? []).some((tag) => tag.startsWith(prefix)),
        )) &&
      (selector.blockEntity === undefined ||
        (typeof selector.blockEntity === 'boolean' &&
          blocks.some((block) => block.blockEntity === selector.blockEntity)))
    )
  }
  const excluded = rules.exclusions.some(matches)
  return {
    excluded,
    families: excluded
      ? []
      : rules.families
          .filter((family) => family.selectors.some(matches))
          .map((family) => family.id),
  }
}

export function equipmentMembership(rules, item, blocks = []) {
  return classify(rules, item, blocks).families
}

export function equipmentReview({ rules, items, blocks, versions, routes }) {
  if (
    new Set(rules.families.map((family) => family.id)).size !==
    rules.families.length
  )
    throw new Error('Duplicate equipment family')
  const byItem = new Map(),
    byVersion = new Map(versions.map((mod) => [mod.id, mod]))
  for (const block of blocks) {
    if (typeof block.blockEntity !== 'boolean' || !Array.isArray(block.types))
      throw new Error(
        'Refresh the native registry capture: block type evidence is missing',
      )
    if (!byItem.has(block.item)) byItem.set(block.item, [])
    byItem.get(block.item).push(block)
  }
  const outputs = new Map()
  for (const route of routes)
    for (const id of route.outputs ?? []) {
      if (!outputs.has(id)) outputs.set(id, [])
      outputs.get(id).push(route.id)
    }
  const entries = [],
    uncertain = []
  for (const item of items) {
    const itemBlocks = byItem.get(item.id) ?? []
    const classification = classify(rules, item, itemBlocks)
    if (classification.excluded) continue
    const families = classification.families
    if (!families.length) {
      if (
        (itemBlocks.some((block) => block.blockEntity) ||
          (!itemBlocks.length &&
            !item.components?.['minecraft:food'] &&
            !item.types.includes('net.minecraft.world.item.SpawnEggItem') &&
            item.class !== 'net.minecraft.world.item.Item')) &&
        item.id !== 'minecraft:air'
      )
        uncertain.push({
          id: item.id,
          class: item.class,
          reason: itemBlocks.some((block) => block.blockEntity)
            ? 'Unclassified block-entity item; not assumed to be equipment'
            : 'Unclassified custom item; not assumed to be equipment',
        })
      continue
    }
    const provider = byVersion.get(item.id.split(':')[0])
    const references = [...new Set(outputs.get(item.id) ?? [])].sort()
    entries.push({
      id: item.id,
      name: item.name ?? item.translation,
      provider: provider ?? { id: item.id.split(':')[0], version: null },
      families,
      class: item.class,
      blocks: itemBlocks.map((block) => block.id).sort(),
      defaultComponents: item.components ?? null,
      componentError: item.stackError ?? null,
      acquisition: references,
      acquisitionStatus: references.length
        ? 'potential-routes'
        : 'no-indexed-route',
      rendererReview: item.types.includes('artifacts.item.WearableArtifactItem')
        ? 'Native equipped layer; compare the versioned default-pose/slot baseline in docs/development/equipment.md before claiming this snapshot qualified'
        : 'Native/selected resource owners; client renderer and interaction require per-item review',
      decision: rules.decision,
    })
  }
  const needed = new Set(entries.flatMap((entry) => entry.acquisition))
  const itemMap = new Map(items.map((item) => [item.id, item]))
  const unresolved = uncertain.map((row) => {
    const item = itemMap.get(row.id)
    return {
      ...row,
      provider: byVersion.get(item.id.split(':')[0]) ?? {
        id: item.id.split(':')[0],
        version: null,
      },
      blocks: (byItem.get(item.id) ?? []).map((block) => block.id).sort(),
      defaultComponents: item.components ?? null,
      componentError: item.stackError ?? null,
      acquisition: [...new Set(outputs.get(item.id) ?? [])].sort(),
      decision: 'needs-classification',
    }
  })
  for (const row of unresolved) for (const id of row.acquisition) needed.add(id)
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return {
    schema: 1,
    families: rules.families.map(({ selectors, ...family }) => ({
      ...family,
      count: entries.filter((entry) => entry.families.includes(family.id))
        .length,
    })),
    entries: entries.sort(byId),
    uncertain: unresolved.sort(byId),
    routes: routes.filter((route) => needed.has(route.id)).sort(byId),
    limits: [
      'Membership is a review classification, not a functional or render test.',
      'Routes retain conditions and raw probabilities; reachability is not availability or a yield guarantee.',
      'Unknown acquisition/rendering and unclassified custom or block-entity items remain visible for triage.',
    ],
  }
}
