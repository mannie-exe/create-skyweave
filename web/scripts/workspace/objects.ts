import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { artifactSchema } from '../../src/lib/workspace/contracts.ts'
import {
  defineOperation,
  type Execution,
  type Registration,
} from './service.ts'
import { createObjectInputs, type ObjectMode } from './object-inputs.ts'
import { target, artifactRead } from './policy.ts'
import { hash, canonical } from './identity.ts'
import { ownedDirectory } from './paths.ts'
import { WorkspaceError } from './errors.ts'
import { loadedTool } from './loaded-tool.ts'
import {
  assetProjectionFiles,
  scopedResourceLinks,
  assetProjectionRevision,
} from './asset-projection.ts'
import type { NativeExecutor } from './native.ts'
import type { EnvironmentResolver } from './environment.ts'
import type { createArtifactStore } from './artifacts.ts'

const ownRevision = loadedTool(import.meta.url)
const previewInput = z.strictObject({
  object: z
    .string()
    .regex(/^(block|entity)\/[a-z0-9_.-]+:[a-z0-9_./-]+$/)
    .max(200),
  case: z.string().min(1).max(160),
  layers: z.array(z.string().min(1).max(200)).max(192),
})
const empty = z.strictObject({})
const result = z.strictObject({
  artifact: artifactSchema,
  output: z.string().max(1000),
})

export function objectDefinitions(
  registrations: Registration[],
  native: NativeExecutor,
  artifacts: ReturnType<typeof createArtifactStore>,
  environments: EnvironmentResolver,
) {
  const inputs = createObjectInputs(registrations, environments, artifacts)
  async function catalogue(ctx: Parameters<typeof inputs.vector>[0]) {
    const current = await artifacts.active(
      ctx,
      ctx.scope,
      'objects',
      'index.json',
    )
    const reference = current?.files['index.json']
    if (!current || !reference)
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Refresh object previews before changing a stack.',
        'after-refresh',
      )
    if (reference.byteLength > 8 * 1024 * 1024)
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'Object catalogue exceeds its limit',
      )
    return { current, reference }
  }
  async function vector(
    ctx: Execution | Parameters<typeof inputs.vector>[0],
    mode: ObjectMode,
    draft?: z.infer<typeof previewInput>,
  ) {
    const values = await inputs.vector(ctx, mode)
    values['tool:atlas:objects'] = await ownRevision()
    values['tool:atlas:asset-projection'] = await assetProjectionRevision()
    values['tool:atlas:artifacts'] = await artifacts.revision()
    if (draft) {
      const registered = await catalogue(ctx)
      if (registered.current.inputRevision !== hash(canonical(values)))
        throw new WorkspaceError(
          'REVISION_CONFLICT',
          'Object inputs changed. Refresh previews before changing a stack.',
          'after-refresh',
        )
      const resolved = await artifacts.resolve(
        ctx,
        ctx.scope,
        registered.reference.id,
      )
      const data = JSON.parse(await fs.readFile(resolved.file, 'utf8'))
      const object = data.objects?.find(
        (entry: { id: string }) => entry.id === draft.object,
      )
      if (
        !object ||
        !object.cases?.some(
          (entry: { id: string }) => entry.id === draft.case,
        ) ||
        new Set(draft.layers).size !== draft.layers.length ||
        draft.layers.some(
          (id) =>
            !data.layers?.some((entry: { id: string }) => entry.id === id),
        )
      )
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Choose a registered object, case and resource stack.',
        )
      values['projection:objects:index'] = registered.reference.sha256
      values['draft:object-stack'] = hash(canonical(draft))
    }
    return values
  }
  async function stage(ctx: Execution) {
    return operationStaging(ctx, 'objects')
  }
  async function execute(
    ctx: Execution,
    mode: ObjectMode,
    draft?: z.infer<typeof previewInput>,
  ) {
    const environment = await environments.resolve(ctx.registration, ctx)
    const observation = () =>
      environments
        .resolve(ctx.registration, ctx)
        .then(
          (value) =>
            canonical(value.trusted.configured) +
            canonical(value.trusted.executables),
        )
    const observed = await observation()
    async function recheck() {
      if (
        canonical(await vector(ctx, mode, draft)) !==
          canonical(ctx.inputRevisions) ||
        (await observation()) !== observed
      )
        throw new WorkspaceError(
          'REVISION_CONFLICT',
          'Object inputs changed; existing projections were kept.',
          'after-refresh',
        )
      await ctx.authorize()
    }
    await recheck()
    const directory = await stage(ctx),
      output = path.join(directory, 'output')
    await fs.mkdir(output)
    const provenance = {
      scope: ctx.scope,
      profile: environment.manifest.resources.profileId,
      minecraft: environment.manifest.selected.minecraft,
      loader: environment.manifest.selected.loader,
      adapter:
        mode === 'export'
          ? 'minecraft-static-factories'
          : 'selected-resource-generation',
      adapterVersion: 1,
      inputRevision: hash(canonical(ctx.inputRevisions)),
      observed: environment.manifest.observed
        ? {
            snapshotId: environment.manifest.observed.snapshotId,
            currentLock: environment.manifest.observed.currentLock,
          }
        : null,
    }
    try {
      if (mode === 'inputs') {
        const records = await inputs.candidates(ctx)
        const cache = await ownedDirectory(
          await fs.realpath(ctx.registration.pack),
          '.cache/resource-candidates',
        )
        await native.run(ctx, 'objects.inputs', {}, { staging: output })
        for (const record of records) {
          const candidate = path.join(output, path.basename(record.path)),
            actual = await inputs.digest(candidate, 64 * 1024 * 1024)
          if (
            actual.sha512 !== record.sha512 ||
            actual.byteLength !== record.size
          )
            throw new WorkspaceError(
              'GENERATION_FAILED',
              'Candidate output differs from its pin',
            )
          await recheck()
          const destination = path.join(cache, path.basename(record.path))
          try {
            const previous = await inputs.digest(destination, 64 * 1024 * 1024)
            if (previous.sha512 !== record.sha512)
              throw new WorkspaceError(
                'REVISION_CONFLICT',
                'A cached candidate changed; review its pin.',
                'after-refresh',
              )
            continue
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
          const temporary = destination + '.' + ctx.operationId + '.tmp'
          try {
            await fs.copyFile(candidate, temporary, fs.constants.COPYFILE_EXCL)
            await recheck()
            // Exclusive link publishes a verified new cache entry without replacing an external file.
            try {
              await fs.link(temporary, destination)
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
                throw error
              if (
                (await inputs.digest(destination, 64 * 1024 * 1024)).sha512 !==
                record.sha512
              )
                throw new WorkspaceError(
                  'REVISION_CONFLICT',
                  'A cached candidate changed during publication.',
                  'after-refresh',
                )
            }
            ctx.committed('input:' + record.id, { [record.id]: actual.sha256 })
          } finally {
            await fs.rm(temporary, { force: true })
          }
        }
        const report = path.join(directory, 'inputs.json')
        await fs.writeFile(
          report,
          JSON.stringify({
            schema: 1,
            inputs: records.map(({ id, sha512, size }) => ({
              id,
              sha512,
              size,
            })),
          }),
        )
        const generation = await artifacts.publish(ctx, {
          namespace: 'object-inputs',
          staging: directory,
          files: { 'inputs.json': report },
          inputs: { ...ctx.inputRevisions },
          recheck,
        })
        return {
          artifact: generation.files['inputs.json'],
          output: records.length + ' pinned candidate inputs ready',
        }
      }
      if (mode === 'export') {
        await native.run(ctx, 'objects.export', {}, { staging: output })
        const files: Record<string, string> = {}
        for (const name of [
          'native-models.json',
          'inputs.json',
          'cem-inputs.json',
        ]) {
          const file = path.join(output, name),
            value = JSON.parse(await fs.readFile(file, 'utf8'))
          if (
            name === 'native-models.json' &&
            (value.schema !== 1 ||
              !value.models ||
              typeof value.models !== 'object')
          )
            throw new WorkspaceError(
              'GENERATION_FAILED',
              'Static model output is invalid',
            )
          files[name] = file
        }
        const generation = await artifacts.publish(ctx, {
          namespace: 'native-models',
          staging: output,
          files,
          inputs: { ...ctx.inputRevisions },
          recheck,
        })
        return {
          artifact: generation.files['inputs.json'],
          output: 'Static model definitions exported',
        }
      }
      const prepared = await inputs.stageInputs(ctx, directory)
      await recheck()
      await native.run(
        ctx,
        mode === 'preview' ? 'objects.preview' : 'objects.generate',
        draft ?? {},
        {
          staging: output,
          nativeInputs: prepared.nativeInputs,
          textureIndex: prepared.textureIndex,
        },
      )
      const entry = mode === 'preview' ? 'preview.json' : 'index.json',
        files = await assetProjectionFiles(output, entry)
      const document = JSON.parse(await fs.readFile(files[entry], 'utf8'))
      if (
        (mode === 'generate' &&
          (document.schema !== 1 || !Array.isArray(document.objects))) ||
        (mode === 'preview' &&
          (!document.preview || !Array.isArray(document.evidence)))
      )
        throw new WorkspaceError(
          'GENERATION_FAILED',
          'Object projection is incomplete',
        )
      const generation = await artifacts.publish(ctx, {
        namespace: mode === 'preview' ? 'objects-preview' : 'objects',
        staging: output,
        files,
        inputs: { ...ctx.inputRevisions },
        recheck,
        dependencies: prepared.dependencies,
        rewriteJSON: (value, references, logical) =>
          scopedResourceLinks(
            '/generated/objects/',
            logical === entry
              ? {
                  ...(value as Record<string, unknown>),
                  environment: provenance,
                }
              : value,
            references,
          ),
      })
      return {
        artifact: generation.files[entry],
        output:
          mode === 'preview'
            ? 'Object preview ready'
            : 'Object previews refreshed',
      }
    } finally {
      await disposeStaging(ctx, directory)
    }
  }
  const definitions: ReturnType<typeof defineOperation<any, any>>[] = []
  for (const mode of ['inputs', 'export', 'generate'] as const)
    definitions.push(
      defineOperation({
        name: 'objects.' + mode,
        effect: mode === 'inputs' ? 'download' : 'generate',
        input: empty,
        output: result,
        label:
          mode === 'inputs'
            ? 'Fetch candidate inputs'
            : mode === 'export'
              ? 'Export static models'
              : 'Refresh object previews',
        href: '/resource-authoring',
        success:
          mode === 'inputs'
            ? 'Pinned inputs ready. Pack selections are unchanged.'
            : mode === 'export'
              ? 'Static model definitions exported. No Minecraft instance started.'
              : 'Object previews refreshed. Instances were not changed.',
        targets: async (ctx) => [
          ...(await inputs.grants(ctx, mode)),
          {
            action: 'generation.run',
            target: target(
              ctx.scope,
              'projection',
              mode === 'inputs'
                ? 'object-inputs'
                : mode === 'export'
                  ? 'native-models'
                  : 'objects',
            ),
          },
        ],
        resultTargets: (_ctx, value) => [artifactRead(value.artifact)],
        inputs: (ctx) => vector(ctx, mode),
        available: () => native.available(),
        execute: (ctx) => execute(ctx, mode),
      }),
    )
  definitions.push(
    defineOperation({
      name: 'objects.preview',
      effect: 'preview',
      input: previewInput,
      output: result,
      label: 'Preview object stack',
      href: '/resource-authoring',
      success: 'Object preview ready.',
      targets: async (ctx) => [
        ...(await inputs.grants(ctx, 'preview')),
        artifactRead((await catalogue(ctx)).reference),
        {
          action: 'preview.run',
          target: target(ctx.scope, 'projection', 'objects-preview'),
        },
      ],
      resultTargets: (_ctx, value) => [artifactRead(value.artifact)],
      inputs: (ctx, input) => vector(ctx, 'preview', input),
      available: () => native.available(),
      execute: (ctx, input) => execute(ctx, 'preview', input),
    }),
  )
  return definitions
}
