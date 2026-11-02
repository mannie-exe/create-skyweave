import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

export function clientResourceInputs(pack, lock) {
  const inputs = []
  for (const [id, dependency] of Object.entries(lock.dependencies)) {
    for (const file of dependency.files) {
      for (const place of file.placements) {
        const participation = place.environment.client
        if (participation !== 'required' && !participation?.['default-enabled'])
          continue
        if (!/^(mods|resourcepacks)\/[^/]+\.(jar|zip)$/.test(place.destination))
          continue
        const folder = { common: 'pack', client: 'overrides/client' }[
          place.layer
        ]
        if (!folder) throw new Error(`${id}: invalid client resource layer`)
        const base = resolve(pack, folder),
          path = resolve(base, place.destination),
          inside = relative(base, path)
        if (inside.startsWith('..') || isAbsolute(inside))
          throw new Error(`${id}: invalid resource destination`)
        inputs.push({
          id,
          path,
          destination: place.destination,
          expected: file.expected,
          version: dependency.selection?.selection?.id,
        })
      }
    }
  }
  return { runtime: lock.runtime, inputs }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const pack = resolve(process.argv[2])
  process.stdout.write(
    JSON.stringify(
      clientResourceInputs(
        pack,
        YAML.parse(readFileSync(resolve(pack, 'empack.lock'), 'utf8')),
      ),
    ),
  )
}
