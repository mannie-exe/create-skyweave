import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'
import { clientResourceInputs } from '../resource-inputs.mjs'
import { createResourceInputs } from './models.ts'
import { createSourceRepository } from './files.ts'
import { createInputDigests } from './digests.ts'
import { createPackOutput } from './pack-output.ts'
import { canonical, hash } from './identity.ts'
import { target, scopeKey, artifactRead } from './policy.ts'
import type { Grant } from './policy.ts'
import { WorkspaceError } from './errors.ts'
import { loadedTool } from './loaded-tool.ts'
import type { Registration, Resolved } from './service.ts'
import type { EnvironmentResolver } from './environment.ts'
import type { createArtifactStore } from './artifacts.ts'

export type ObjectMode = 'inputs' | 'export' | 'generate' | 'preview'
const ownRevision = loadedTool(import.meta.url)
const nativeNames = [
  'native-models.json',
  'inputs.json',
  'cem-inputs.json',
] as const
const candidate = z.object({
  id: z.string().regex(/^candidate-[a-z0-9-]{1,100}$/),
  path: z.string().regex(/^\.cache\/resource-candidates\/[a-z0-9_.-]+\.zip$/),
  sha512: z.string().regex(/^[a-f0-9]{128}$/),
  size: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  download: z.url().refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'cdn.modrinth.com' &&
      !url.username &&
      !url.password
    )
  }),
})

export function createObjectInputs(
  registrations: Registration[],
  environments: EnvironmentResolver,
  artifacts: ReturnType<typeof createArtifactStore>,
) {
  const sources = new Map(
    registrations.map((r) => [scopeKey(r.scope), createSourceRepository(r)]),
  )
  const resource = createResourceInputs(registrations),
    digest = createInputDigests(),
    output = createPackOutput()
  const source = (ctx: Resolved) => sources.get(scopeKey(ctx.scope))!
  async function candidates(ctx: Resolved) {
    const document = JSON.parse(
      (await source(ctx).read('resource-objects')).text,
    )
    return z
      .array(candidate)
      .max(64)
      .parse(document.candidates ?? [])
  }
  async function client(ctx: Resolved) {
    const lock = YAML.parse((await source(ctx).read('pack:lock')).text, {
      maxAliasCount: 20,
    })
    const selected = clientResourceInputs(ctx.registration.pack, lock)
    if (selected.inputs.length > 1000)
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'Too many client resource inputs',
      )
    return selected.inputs as Array<{
      id: string
      path: string
      destination: string
      expected: { size?: number; digests: Record<string, string> }
    }>
  }
  async function texture(ctx: Resolved) {
    const generation = await artifacts.active(
      ctx,
      ctx.scope,
      'texture-resources',
      'index.json',
    )
    const index = generation?.files['index.json']
    if (!index)
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Refresh texture previews before rebuilding objects.',
        'after-refresh',
      )
    return index
  }
  async function native(ctx: Resolved) {
    const generation = await artifacts.active(ctx, ctx.scope, 'native-models')
    if (generation) {
      if (nativeNames.some((name) => !generation.files[name]))
        throw new WorkspaceError(
          'NOT_FOUND',
          'Static model inputs are unavailable',
        )
      return { generation, files: generation.files }
    }
    return null
  }
  async function grants(ctx: Resolved, mode: ObjectMode) {
    const ids =
      mode === 'inputs'
        ? ['resource-objects']
        : [
            ...(mode === 'export'
              ? [
                  'resource-pins',
                  'resource-objects',
                  'client:options',
                  'pack:manifest',
                  'pack:lock',
                ]
              : await source(ctx).list('models')),
            'resource-objects',
            'client:options',
            'pack:manifest',
            'pack:lock',
          ]
    const required: Grant[] = [...new Set(ids)].map((id) => ({
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', id),
    }))
    if (mode !== 'inputs') {
      for (const file of await client(ctx))
        required.push({
          action: 'source.read',
          target: target(ctx.scope, 'source', 'client:' + file.id),
        })
      required.push({
        action: 'source.read',
        target: target(ctx.scope, 'source', 'asset:minecraft'),
      })
      if (mode === 'export')
        required.push({
          action: 'source.read',
          target: target(ctx.scope, 'source', 'native:loader-libraries'),
        })
    }
    if (mode === 'generate' || mode === 'preview') {
      required.push(...(await resource.grants(ctx)))
      required.push(
        {
          action: 'source.read',
          target: target(ctx.scope, 'source', 'runtime:blocks'),
        },
        {
          action: 'source.read',
          target: target(ctx.scope, 'source', 'runtime:entities'),
        },
        {
          action: 'source.read',
          target: target(
            ctx.scope,
            'source',
            'output:skyweave-resource-patches',
          ),
        },
        {
          action: 'source.read',
          target: target(ctx.scope, 'source', 'output:skyweave-visual-patches'),
        },
      )
      required.push(artifactRead(await texture(ctx)))
      const current = await native(ctx)
      if (current)
        required.push(
          ...nativeNames.map((name) => artifactRead(current.files[name])),
        )
      else
        required.push({
          action: 'source.read',
          target: target(ctx.scope, 'source', 'native:cache'),
        })
    }
    return [
      ...new Map(
        required.map((grant) => [
          grant.action + '\0' + grant.target.kind + '\0' + grant.target.id,
          grant,
        ]),
      ).values(),
    ]
  }
  async function fileHash(file: string, optional = false) {
    try {
      return (await digest(file)).sha256
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT')
        return null
      throw error
    }
  }
  async function toolVector(ctx: Resolved, mode: ObjectMode) {
    const values: Record<string, string> = {
      'tool:atlas:object-inputs': await ownRevision(),
    }
    const rootTools =
      mode === 'inputs'
        ? [
            'build-resource-objects.py',
            'object_inputs.py',
            'resource_stack.py',
            'model_authoring.py',
            'resource_assets.py',
            'model_transforms.py',
            'cem_geometry.py',
          ]
        : [
            'build-resource-objects.py',
            'object_inputs.py',
            'resource_stack.py',
            'model_authoring.py',
            'resource_assets.py',
            'model_transforms.py',
            'cem_geometry.py',
            'texture_resources.py',
            'lootr_artwork.py',
          ]
    for (const name of rootTools)
      values['tool:' + name] = (await fileHash(
        path.join(ctx.registration.pack, 'scripts', name),
      ))!
    if (mode !== 'inputs')
      for (const name of [
        'scripts/resource-inputs.mjs',
        'scripts/export-models.py',
        'scripts/paths.py',
        'tools/resource-exporter/StaticModels.java',
        'pnpm-lock.yaml',
      ])
        values['tool:web:' + name] = (await fileHash(
          path.join(ctx.registration.web, name),
        ))!
    return values
  }
  async function vector(ctx: Resolved, mode: ObjectMode) {
    const repository = source(ctx),
      values: Record<string, string> = { ...(await toolVector(ctx, mode)) }
    const ids =
      mode === 'inputs'
        ? ['resource-objects']
        : [
            'resource-objects',
            'resource-pins',
            'client:options',
            'pack:manifest',
            'pack:lock',
          ]
    const current = await repository.snapshot(ids)
    for (const [id, file] of Object.entries(current.files))
      values[id] = file.revision
    if (mode === 'inputs') return values
    const environment = await environments.resolve(ctx.registration, ctx)
    if (
      !environment.trusted.profile ||
      !environment.manifest.selected.intentMatchesLock
    )
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Object adapters need the supported locked runtime.',
        'after-refresh',
      )
    values['profile:objects'] = hash(canonical(environment.trusted.profile))
    const pin = JSON.parse(current.files['resource-pins'].text).sources
      ?.minecraft
    if (
      !pin ||
      typeof pin.path !== 'string' ||
      path.isAbsolute(pin.path) ||
      pin.path.split(/[\\/]/).includes('..')
    )
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Invalid vanilla resource input',
      )
    const vanilla = await digest(path.join(ctx.registration.pack, pin.path))
    if (vanilla.sha512 !== pin.sha512)
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Materialize the pinned Minecraft resource input.',
        'after-refresh',
      )
    values['asset:minecraft'] = vanilla.sha256
    let total = vanilla.byteLength
    for (const file of await client(ctx)) {
      const actual = await digest(file.path)
      total += actual.byteLength
      if (total > 4 * 1024 * 1024 * 1024)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Client resource inputs exceed 4 GiB',
        )
      const expected = Object.entries(file.expected?.digests ?? {})
      if (
        !expected.length ||
        expected.some(
          ([algorithm, value]) =>
            !['sha1', 'sha256', 'sha512'].includes(algorithm) ||
            actual[algorithm as 'sha1' | 'sha256' | 'sha512'] !== value,
        ) ||
        (file.expected.size != null && file.expected.size !== actual.byteLength)
      )
        throw new WorkspaceError(
          'CAPABILITY_UNAVAILABLE',
          'A client resource differs from its lock: ' + file.id,
          'after-refresh',
        )
      values['client:' + file.id + ':' + file.destination] = actual.sha256
    }
    if (mode === 'export') {
      const mapped =
        environment.trusted.configured.mappedClient ??
        path.join(
          ctx.registration.pack,
          '.cache/resource-inputs/mapped-client.jar',
        )
      values['native:mapped-client'] = (
        await digest(await fs.realpath(mapped))
      ).sha256
      const server = environment.trusted.configured.server
      if (!server)
        throw new WorkspaceError(
          'CAPABILITY_UNAVAILABLE',
          'Configure the locked loader libraries before exporting.',
          'after-refresh',
        )
      const libraries = path.join(server, 'libraries'),
        argsFile = path.join(
          libraries,
          'net/neoforged/neoforge',
          environment.manifest.selected.loader.version,
          'unix_args.txt',
        )
      const args = await fs.readFile(argsFile, 'utf8')
      if (Buffer.byteLength(args) > 100000)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Loader arguments exceed their limit',
        )
      values['native:loader-arguments'] = hash(args)
      const libraryPaths = [
        ...new Set(args.match(/libraries\/[^\s:;]+\.jar/g) ?? []),
      ].filter((value) => !value.includes('net/neoforged/neoforge'))
      if (!libraryPaths.length || libraryPaths.length > 300)
        throw new WorkspaceError(
          'CAPABILITY_UNAVAILABLE',
          'The locked loader library set is unavailable',
        )
      for (const relative of libraryPaths) {
        if (relative.split('/').includes('..'))
          throw new WorkspaceError(
            'INVALID_INPUT',
            'Invalid loader library path',
          )
        values['native:' + relative] = (await fileHash(
          path.join(libraries, relative.slice('libraries/'.length)),
        ))!
      }
      return values
    }
    Object.assign(
      values,
      await resource.vector(ctx, false, [
        'build-resource-objects.py',
        'object_inputs.py',
        'resource_stack.py',
        'resource_assets.py',
        'model_transforms.py',
        'cem_geometry.py',
        'texture_resources.py',
        'lootr_artwork.py',
      ]),
    )
    for (const record of await candidates(ctx)) {
      const actual = await digest(
        path.join(ctx.registration.pack, record.path),
        64 * 1024 * 1024,
      )
      if (actual.byteLength !== record.size || actual.sha512 !== record.sha512)
        throw new WorkspaceError(
          'CAPABILITY_UNAVAILABLE',
          'Fetch the pinned candidate input: ' + record.id,
          'after-refresh',
        )
      values['candidate:' + record.id] = actual.sha256
    }
    for (const name of ['blocks', 'entities'])
      values['runtime:' + name] = (await fileHash(
        path.join(
          ctx.registration.web,
          'data/generated/runtime',
          name + '.json',
        ),
      ))!
    const zip = await output.current(ctx)
    values[
      zip
        ? 'output:skyweave-visual-patches'
        : 'missing:output:skyweave-visual-patches'
    ] = zip ?? hash('')
    values['output:skyweave-resource-patches'] =
      (await fileHash(
        path.join(
          ctx.registration.pack,
          'overrides/common/mods/skyweave-resource-patches-0.1.0.jar',
        ),
        true,
      )) ?? hash('')
    const textureIndex = await texture(ctx)
    values['projection:textures:index'] = textureIndex.sha256
    const exported = await native(ctx)
    for (const name of nativeNames) {
      if (exported)
        values['projection:native:' + name] = exported.files[name].sha256
      else
        values['cache:native:' + name] =
          (await fileHash(
            path.join(ctx.registration.web, '.cache/resource-exporter', name),
            true,
          )) ?? hash('')
    }
    return values
  }
  async function stageInputs(ctx: Resolved, directory: string) {
    const index = await texture(ctx),
      dependencies = [index]
    const resolved = await artifacts.resolve(ctx, ctx.scope, index.id)
    const textureIndex = path.join(directory, 'texture-index.json')
    await fs.copyFile(resolved.file, textureIndex)
    const nativeInputs = path.join(directory, 'native')
    await fs.mkdir(nativeInputs)
    const exported = await native(ctx)
    for (const name of nativeNames) {
      if (exported) {
        const resolved = await artifacts.resolve(
          ctx,
          ctx.scope,
          exported.files[name].id,
        )
        await fs.copyFile(resolved.file, path.join(nativeInputs, name))
      } else {
        const file = path.join(
          ctx.registration.web,
          '.cache/resource-exporter',
          name,
        )
        if (await fileHash(file, true))
          await fs.copyFile(file, path.join(nativeInputs, name))
      }
    }
    if (exported) dependencies.push(exported.files['inputs.json'])
    return { textureIndex, nativeInputs, dependencies }
  }
  return { source, candidates, grants, vector, stageInputs, digest }
}
