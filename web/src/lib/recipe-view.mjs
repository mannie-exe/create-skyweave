import { fluidState, potionNode } from './acquisition.mjs'

export const safeIcon = (icon) =>
  typeof icon === 'string' &&
  (/^\/generated\/icons\/[a-f0-9]+\.(?:png|svg)$/.test(icon) ||
    /^\/workspace-snapshot\/[a-z0-9][a-z0-9_-]{0,63}\/[a-z0-9][a-z0-9_-]{0,63}\/assets\/[a-f0-9]{64}-[a-f0-9]{64}\.(?:png|svg)$/.test(
      icon,
    ) ||
    /^\/__atlas\/workspaces\/[a-z0-9][a-z0-9_-]{0,63}\/packs\/[a-z0-9][a-z0-9_-]{0,63}\/artifacts\/[a-f0-9]{64}$/.test(
      icon,
    ))
    ? icon
    : null

const cooking = new Set([
  'minecraft:smelting',
  'minecraft:blasting',
  'minecraft:smoking',
  'minecraft:campfire_cooking',
])
const processing = new Set([
  'create:pressing',
  'create:mixing',
  'create:compacting',
  'create:crushing',
  'create:milling',
  'create:cutting',
  'create:splashing',
  'create:haunting',
  'create:filling',
  'create:emptying',
  'create:deploying',
  'create:item_application',
  'create:sandpaper_polishing',
])

// Recipe JSON owns quantities and layout. Resolved groups supply tag alternatives;
// later groups in the atlas can be machinery/capabilities, not consumed slots.
export function recipePresentation(recipe) {
  const json = recipe.json ?? {},
    type = json.type ?? recipe.type
  let raw = [],
    columns = 3,
    shape = 'processing',
    supported = true
  if (
    ['minecraft:crafting_shaped', 'create:mechanical_crafting'].includes(type)
  ) {
    const pattern = json.pattern ?? [],
      keys = Object.keys(json.key ?? {})
    columns = Math.max(1, ...pattern.map((row) => row.length))
    if (!pattern.length || columns > 9 || pattern.length > 9) supported = false
    else
      raw = pattern.flatMap((row) =>
        Array.from({ length: columns }, (_, i) => {
          const key = row[i] ?? ' '
          return key === ' '
            ? null
            : {
                value: json.key?.[key],
                resolved: recipe.ingredients?.[keys.indexOf(key)],
              }
        }),
      )
    shape = 'shaped'
  } else if (type === 'minecraft:crafting_shapeless' || processing.has(type)) {
    raw = (json.ingredients ?? []).map((value, i) => ({
      value,
      resolved: recipe.ingredients?.[i],
    }))
    shape = type === 'minecraft:crafting_shapeless' ? 'shapeless' : 'processing'
  } else if (cooking.has(type) || type === 'minecraft:stonecutting') {
    raw = [{ value: json.ingredient, resolved: recipe.ingredients?.[0] }]
    columns = 1
  } else if (
    ['minecraft:smithing_transform', 'minecraft:smithing_trim'].includes(type)
  ) {
    raw = ['template', 'base', 'addition'].map((key, i) => ({
      value: json[key],
      resolved: recipe.ingredients?.[i],
    }))
  } else supported = false
  if (raw.length > 81) supported = false
  const declaredInputs =
    json.ingredients ??
    (json.ingredient
      ? [json.ingredient]
      : json.key
        ? Object.values(json.key)
        : json.base
          ? [json.template, json.base, json.addition].filter(Boolean)
          : [])
  const requirements = supported
    ? [
        ...new Map(
          (recipe.ingredients ?? [])
            .slice(declaredInputs.length)
            .map((group) => [JSON.stringify([...group].sort()), group]),
        ).values(),
      ]
    : []
  const derivedOutput = type === 'minecraft:smithing_trim'
  const declared = json.results ?? (json.result ? [json.result] : [])
  const outputs = declared.slice(0, 24).map((value) => {
    const stack = typeof value === 'string' ? { id: value } : value
    const id = stack.id ?? stack.item ?? stack.fluid
    return {
      value: stack,
      resolved: id
        ? [
            stack.amount !== undefined
              ? fluidState({ ...stack, id })
              : potionNode({ ...stack, id }),
          ]
        : [],
    }
  })
  return {
    type,
    supported,
    shape,
    columns,
    inputs: supported ? raw : [],
    outputs: derivedOutput
      ? [{ derived: true, value: {}, resolved: [] }]
      : outputs,
    derivedOutput,
    requirements,
    hiddenOutputs: Math.max(0, declared.length - 24),
    conditions: Object.fromEntries(
      Object.entries(json).filter(([key]) =>
        [
          'heat_requirement',
          'processing_time',
          'processingTime',
          'cookingtime',
          'experience',
          'keep_held_item',
          'accept_mirrored',
          'neoforge:conditions',
        ].includes(key),
      ),
    ),
  }
}
