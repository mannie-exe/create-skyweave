import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

function participates(requirement) {
  if (requirement === 'required') return true
  if (requirement === 'unsupported') return false
  if (
    requirement?.optional &&
    typeof requirement['default-enabled'] === 'boolean'
  )
    return requirement['default-enabled']
  throw new Error('Unrecognized server participation in empack.lock')
}

export function serverModInputs(pack, lock, read = readFileSync) {
  const mods = []
  const destinations = new Set()
  for (const [key, dependency] of Object.entries(lock.dependencies)) {
    for (const file of dependency.files) {
      for (const place of file.placements) {
        if (!participates(place.environment.server)) continue
        const destination = place.destination
        if (!destination.startsWith('mods/') || !destination.endsWith('.jar'))
          continue
        const folder = { common: 'pack', server: 'overrides/server' }[
          place.layer
        ]
        if (!folder)
          throw new Error(`${key}: server mod has invalid layer ${place.layer}`)
        const base = resolve(pack, folder)
        const path = resolve(base, destination)
        const inside = relative(base, path)
        if (
          inside.startsWith('..') ||
          isAbsolute(inside) ||
          basename(destination) !== destination.slice(5)
        )
          throw new Error(`${key}: invalid mod destination`)
        if (destinations.has(destination))
          throw new Error(`Duplicate server mod: ${destination}`)
        destinations.add(destination)
        let bytes
        try {
          bytes = read(path)
        } catch {
          throw new Error(
            `${key}: materialized JAR missing; run empack sync --materialize`,
          )
        }
        const expected = file.expected
        if (expected.size != null && expected.size !== bytes.length)
          throw new Error(`${key}: materialized JAR size changed`)
        const digests = Object.entries(expected.digests || {})
        if (!digests.length)
          throw new Error(`${key}: no locked digest for runtime input`)
        for (const [algorithm, digest] of digests) {
          if (createHash(algorithm).update(bytes).digest('hex') !== digest)
            throw new Error(`${key}: materialized JAR ${algorithm} mismatch`)
        }
        mods.push({ key, path, destination })
      }
    }
  }
  return { runtime: lock.runtime, mods }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const pack = resolve(process.argv[2])
  const lock = YAML.parse(readFileSync(resolve(pack, 'empack.lock'), 'utf8'))
  process.stdout.write(JSON.stringify(serverModInputs(pack, lock)))
}
