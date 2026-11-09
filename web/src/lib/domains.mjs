import { validateEnvironmentPolicy } from './availability.mjs'
import { parse } from 'yaml'

export const domains = [
  'items',
  'acquisition',
  'recipes',
  'interactions',
  'mobs',
  'progression',
  'worldgen',
  'configuration',
]
const identifier = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/
export function validateDomain(name, text) {
  if (!domains.includes(name)) throw new Error('Unknown domain')
  if (Buffer.byteLength(text) > 1024 * 1024)
    throw new Error('Domain exceeds 1 MiB')
  const data = parse(text, { maxAliasCount: 20 })
  if (!data || data.schema !== 1) throw new Error('schema must be 1')
  if (name === 'recipes') {
    if (!Array.isArray(data.changes))
      throw new Error('changes must be an array')
    const seen = new Set()
    for (const change of data.changes) {
      if (!identifier.test(change.id) || change.id.includes('..'))
        throw new Error('Invalid recipe id')
      if (seen.has(change.id)) throw new Error('Duplicate recipe id')
      seen.add(change.id)
      if (
        change.disabled !== true &&
        (!change.json ||
          typeof change.json !== 'object' ||
          !identifier.test(change.json.type ?? ''))
      )
        throw new Error(
          'Each change needs disabled: true or full recipe JSON with a type',
        )
      if (change.disabled === true && change.json)
        throw new Error('Use disabled or json, not both')
    }
  } else if (name === 'items') {
    if (
      !data.notes ||
      typeof data.notes !== 'object' ||
      Array.isArray(data.notes)
    )
      throw new Error('notes must be an item-id mapping')
    for (const [id, note] of Object.entries(data.notes))
      if (!identifier.test(id) || typeof note?.text !== 'string')
        throw new Error('Each item note needs a valid item id and text')
  } else if (name === 'progression') {
    if (
      !Array.isArray(data.roots) ||
      data.roots.some((id) => !identifier.test(id))
    )
      throw new Error('roots must contain item ids')
    if (
      !data.machines ||
      Object.entries(data.machines).some(
        ([k, v]) => !identifier.test(k) || !identifier.test(v),
      )
    )
      throw new Error('machines must map recipe types to item ids')
  } else {
    if (name === 'acquisition' && data.environment !== undefined)
      validateEnvironmentPolicy(data.environment)
    if (!Array.isArray(data.records))
      throw new Error('records must be an array')
    const seen = new Set()
    for (const record of data.records) {
      if (
        typeof record.id !== 'string' ||
        typeof record.title !== 'string' ||
        typeof record.detail !== 'string'
      )
        throw new Error('Records require id, title and detail')
      if (seen.has(record.id)) throw new Error('Duplicate record id')
      seen.add(record.id)
      if (
        record.inputs &&
        (!Array.isArray(record.inputs) ||
          record.inputs.some(
            (g) => !Array.isArray(g) || g.some((id) => !identifier.test(id)),
          ))
      )
        throw new Error('inputs must be arrays of alternative item ids')
      if (
        record.outputs &&
        (!Array.isArray(record.outputs) ||
          record.outputs.some((id) => !identifier.test(id)))
      )
        throw new Error('outputs must contain item ids')
      if (name === 'acquisition') {
        if (record.environment !== undefined) {
          if (
            !record.environment ||
            typeof record.environment !== 'object' ||
            Array.isArray(record.environment) ||
            Object.keys(record.environment).some(
              (key) => !['dimensions', 'structures', 'features'].includes(key),
            )
          )
            throw new Error('Invalid source environment binding')
          if (Object.keys(record.environment).length !== 1)
            throw new Error(
              'Each source environment binding needs exactly one source kind',
            )
          for (const values of Object.values(record.environment))
            if (
              !Array.isArray(values) ||
              !values.length ||
              values.some((id) => !identifier.test(id))
            )
              throw new Error(
                'Source bindings must contain dimension/structure identifiers',
              )
        }
        for (const key of ['roots', 'blocks', 'entities', 'excluded'])
          if (
            record[key] &&
            (!Array.isArray(record[key]) ||
              record[key].some((id) => !identifier.test(id)))
          )
            throw new Error(key + ' must contain identifiers')
        if (
          (record.blocks || record.entities) &&
          !identifier.test(record.gate ?? '')
        )
          throw new Error('Environmental records require a gate')
        if (
          record.aliases &&
          (!Array.isArray(record.aliases) ||
            record.aliases.some(
              (a) =>
                !identifier.test(a.id ?? '') ||
                !identifier.test(a.canonical ?? ''),
            ))
        )
          throw new Error('Aliases require item and canonical identifiers')
      }
      if (
        record.sources &&
        (!Array.isArray(record.sources) ||
          record.sources.some((s) => typeof s !== 'string'))
      )
        throw new Error('sources must contain strings')
    }
  }
  return data
}
