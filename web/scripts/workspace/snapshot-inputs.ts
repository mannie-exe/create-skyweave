import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { serverModDeclarations } from '../runtime-inputs.mjs'
import { clientResourceInputs } from '../resource-inputs.mjs'
import { createSourceRepository } from './files.ts'
import { createInputDigests } from './digests.ts'
import { createGeneratedInputs } from './generated.ts'
import { mapInputVector } from './map-projection.ts'
import { loadedTool } from './loaded-tool.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { target, scopeKey } from './policy.ts'
import type { Resolved, Registration } from './service.ts'
import type { EnvironmentResolver } from './environment.ts'
import { domains } from '../../src/lib/domains.mjs'

const ownRevision = loadedTool(import.meta.url)
type Input = {
  file: string
  expected?: { size?: number; digests: Record<string, string> }
}

export function createSnapshotInputs(
  registrations: Registration[],
  environments: EnvironmentResolver,
) {
  const sources = new Map(
    registrations.map((r) => [scopeKey(r.scope), createSourceRepository(r)]),
  )
  const generated = new Map(
    registrations.map((r) => [scopeKey(r.scope), createGeneratedInputs(r)]),
  )
  const digest = createInputDigests()
  const source = (ctx: Resolved) => sources.get(scopeKey(ctx.scope))!
  const dataset = (ctx: Resolved) => generated.get(scopeKey(ctx.scope))!
  async function discover(ctx: Resolved) {
    const environment = await environments.resolve(ctx.registration, ctx)
    const configured = environment.trusted.configured
    if (
      !configured.server ||
      !configured.vanilla ||
      !environment.trusted.profile ||
      !environment.manifest.selected.intentMatchesLock
    )
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Configure the supported locked runtime and Minecraft inputs before capture.',
        'after-refresh',
      )
    const files: Record<string, Input> = {}
    const lock = YAML.parse((await source(ctx).read('pack:lock')).text, {
      maxAliasCount: 20,
    })
    const selected = [
      ...serverModDeclarations(ctx.registration.pack, lock).mods.map(
        (item) => ({ ...item, id: 'server:' + item.key }),
      ),
      ...clientResourceInputs(ctx.registration.pack, lock)
        .inputs.filter((item) => item.destination.startsWith('mods/'))
        .map((item) => ({ ...item, id: 'client:' + item.id })),
    ]
    for (const item of selected)
      files['mod:' + item.id + ':' + item.destination] = {
        file: item.path,
        expected: item.expected,
      }
    const pins = JSON.parse((await source(ctx).read('resource-pins')).text)
      .sources?.minecraft
    if (!/^[a-f0-9]{128}$/.test(pins?.sha512 ?? ''))
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Minecraft resource pin is unavailable',
      )
    files['asset:minecraft'] = {
      file: configured.vanilla,
      expected: { digests: { sha512: pins.sha512 } },
    }
    async function tree(base: string, prefix: string, extension?: RegExp) {
      let count = 0
      async function visit(folder: string) {
        let entries
        try {
          entries = await fs.readdir(folder, { withFileTypes: true })
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
          throw error
        }
        if ((await fs.realpath(folder)) !== folder)
          throw new WorkspaceError(
            'INVALID_INPUT',
            'Capture input symlinks are not supported',
          )
        for (const entry of entries) {
          const file = path.join(folder, entry.name)
          if (entry.isDirectory()) await visit(file)
          else if (!extension || extension.test(entry.name)) {
            if (!entry.isFile() || ++count > 3000)
              throw new WorkspaceError(
                'CAPACITY_REACHED',
                'Capture input inventory exceeds its limits',
              )
            files[
              prefix + path.relative(base, file).split(path.sep).join('/')
            ] = { file }
          }
        }
      }
      await visit(base)
    }
    const web = ctx.registration.web,
      pack = ctx.registration.pack
    for (const layer of ['common', 'server']) {
      for (const folder of ['config', 'defaultconfigs'])
        await tree(
          path.join(pack, 'overrides', layer, folder),
          `config:authored:${layer}/${folder}/`,
        )
      await tree(
        path.join(pack, 'overrides', layer, 'mods'),
        `mod:override:${layer}/`,
        /\.jar$/,
      )
    }
    for (const folder of ['config', 'defaultconfigs', 'world/serverconfig'])
      await tree(
        path.join(configured.server, folder),
        'config:installed:' + folder + '/',
      )
    await tree(
      path.join(configured.server, 'libraries'),
      'library:',
      /\.(jar|txt)$/,
    )
    files['server:eula'] = { file: path.join(configured.server, 'eula.txt') }
    files['pack:server-template'] = {
      file: path.join(
        ctx.registration.pack,
        'templates/server/game/server.properties.template',
      ),
    }
    await tree(
      path.join(pack, 'resource-patches'),
      'skyweave-resource-patches:',
    )
    await tree(path.join(pack, 'authoring/quests'), 'quests:')
    await tree(
      path.join(web, 'tools/exporter'),
      'tool:exporter:',
      /\.(java|toml)$/,
    )
    for (const name of [
      'runtime.py',
      'runtime_capture.py',
      'fingerprint.py',
      'paths.py',
      'extract.py',
      'item_icons.py',
      'feature_switches.py',
      'runtime-inputs.mjs',
      'resource-inputs.mjs',
    ])
      files['tool:web:' + name] = { file: path.join(web, 'scripts', name) }
    for (const name of [
      'build-resource-patches.py',
      'archive_output.py',
      'generate-quests.py',
      'quests.py',
    ])
      files['tool:pack:' + name] = { file: path.join(pack, 'scripts', name) }
    if (Object.keys(files).length > 10000)
      throw new WorkspaceError('CAPACITY_REACHED', 'Too many capture inputs')
    return { files, environment }
  }
  async function targets(ctx: Resolved, refresh: boolean) {
    const ids = refresh
      ? [
          ...Object.keys((await discover(ctx)).files),
          'pack:manifest',
          'pack:lock',
          'pack:bindings',
          'resource-pins',
          ...domains.map((name) => 'map:' + name),
          'pack:structure-processor',
          ...['world', 'structures', 'islands'].map(
            (name) => 'runtime:' + name,
          ),
          'generated:inputs',
        ]
      : ['pack:lock', 'runtime:snapshot', 'runtime:inputs', 'tool:fingerprint']
    return [...new Set(ids)].map((id) => ({
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', id),
    }))
  }
  async function vector(
    ctx: Resolved,
    refresh: boolean,
    includePrevious = true,
  ) {
    const values: Record<string, string> = {
      'tool:snapshot-inputs': await ownRevision(),
    }
    if (!refresh) {
      values['pack:lock'] = (await source(ctx).read('pack:lock')).revision
      for (const name of ['fingerprint.py', 'paths.py'])
        values['tool:' + name] = (
          await digest(path.join(ctx.registration.web, 'scripts', name))
        ).sha256
      try {
        values['runtime:snapshot'] = (
          await digest(
            path.join(
              ctx.registration.web,
              'data/generated/runtime/snapshot.json',
            ),
            8 * 1024 * 1024,
          )
        ).sha256
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        values['missing:runtime:snapshot'] = hash('')
      }
      return values
    }
    const discovered = await discover(ctx)
    let total = 0
    for (const [id, input] of Object.entries(discovered.files).sort()) {
      const actual = await digest(input.file, 512 * 1024 * 1024).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT')
            throw new WorkspaceError(
              'CAPABILITY_UNAVAILABLE',
              'A capture input is missing. Materialize the pack and configure its tools.',
              'after-refresh',
            )
          throw error
        },
      )
      total += actual.byteLength
      if (total > 6 * 1024 * 1024 * 1024)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Capture inputs exceed 6 GiB',
        )
      if (input.expected) {
        const expected = Object.entries(input.expected.digests ?? {})
        if (
          !expected.length ||
          expected.some(
            ([algorithm, value]) =>
              !['sha1', 'sha256', 'sha512'].includes(algorithm) ||
              actual[algorithm as 'sha1' | 'sha256' | 'sha512'] !== value,
          ) ||
          (input.expected.size != null &&
            input.expected.size !== actual.byteLength)
        )
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            'A capture resource differs from its locked input.',
            'after-refresh',
          )
      }
      values[id] = actual.sha256
    }
    for (const id of [
      'pack:manifest',
      'pack:lock',
      'pack:bindings',
      'resource-pins',
    ])
      values[id] = (await source(ctx).read(id)).revision
    Object.assign(
      values,
      await mapInputVector(ctx.registration, { capture: true }),
    )
    values['profile:runtime'] = hash(
      canonical(discovered.environment.trusted.profile),
    )
    if (includePrevious)
      values['previous:generated'] = dataset(ctx).revision(
        await dataset(ctx).inventory(),
      )
    return values
  }
  return { targets, vector, dataset }
}
