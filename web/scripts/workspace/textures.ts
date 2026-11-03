import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { artifactSchema } from '../../src/lib/workspace/contracts.ts'
import { defineOperation, type Resolved, type Registration } from './service.ts'
import { createResourceInputs } from './models.ts'
import { createPackOutput } from './pack-output.ts'
import { hash, canonical } from './identity.ts'
import { artifactRead, target } from './policy.ts'
import { WorkspaceError } from './errors.ts'
import {
  assetProjectionFiles,
  scopedResourceLinks,
  assetProjectionRevision,
} from './asset-projection.ts'
import type { NativeExecutor } from './native.ts'
import type { EnvironmentResolver } from './environment.ts'
import type { createArtifactStore } from './artifacts.ts'
import { loadedTool } from './loaded-tool.ts'
const textureTool = loadedTool(import.meta.url)

export function textureDefinitions(
  registrations: Registration[],
  native: NativeExecutor,
  artifacts: ReturnType<typeof createArtifactStore>,
  environments: EnvironmentResolver,
) {
  const resource = createResourceInputs(registrations),
    output = createPackOutput()
  async function textureIDs(ctx: Resolved): Promise<string[]> {
    const source = JSON.parse(
      (await resource.sources(ctx).read('texture-resources')).text,
    )
    const ids = new Set<string>()
    for (const record of source.resources ?? [])
      for (const identifier of record.inputs ?? []) {
        if (
          typeof identifier !== 'string' ||
          !/^[a-z0-9_.-]+:[a-z0-9_/-]+$/.test(identifier) ||
          identifier.includes('..')
        )
          throw new WorkspaceError(
            'INVALID_INPUT',
            'Invalid texture input identifier',
          )
        ids.add(identifier)
      }
    return [...ids].sort()
  }
  async function vector(ctx: Resolved) {
    const environment = await environments.resolve(ctx.registration, ctx)
    if (
      !environment.trusted.profile ||
      !environment.manifest.selected.intentMatchesLock
    )
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Texture generation needs the supported locked runtime.',
        'after-refresh',
      )
    const revision = await resource.vector(ctx, false, [
      'build-texture-resources.py',
      'lootr_artwork.py',
      'cem_geometry.py',
      'texture_resources.py',
    ])
    revision['profile:textures'] = hash(canonical(environment.trusted.profile))
    revision['tool:atlas:textures'] = await textureTool()
    revision['tool:atlas:asset-projection'] = await assetProjectionRevision()
    revision['tool:atlas:artifacts'] = await artifacts.revision()
    const patch = await output.current(ctx)
    if (!patch)
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Generate the saved resource pack before refreshing its textures.',
        'after-refresh',
      )
    revision['output:resource-patches'] = patch
    for (const identifier of await textureIDs(ctx)) {
      const [namespace, name] = identifier.split(':')
      const file = path.join(
        ctx.registration.pack,
        'pack-fixes/assets',
        namespace,
        'textures',
        name + '.png',
      )
      try {
        if ((await fs.realpath(file)) !== file)
          throw new WorkspaceError(
            'INVALID_INPUT',
            'Pack-fix texture symlinks are not supported',
          )
        revision['pack-fix:' + identifier] = hash(await fs.readFile(file))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        revision['missing:pack-fix:' + identifier] = hash('')
      }
    }
    return revision
  }
  return [
    defineOperation({
      name: 'textures.generate',
      effect: 'generate',
      input: z.strictObject({}),
      output: z.strictObject({ artifact: artifactSchema, output: z.string() }),
      label: 'Refresh texture previews',
      href: '/resource-authoring?view=textures',
      success: 'Texture previews refreshed. Instances were not changed.',
      targets: async (ctx) => [
        ...(await resource.grants(ctx)),
        {
          action: 'source.read',
          target: target(ctx.scope, 'source', 'output:resource-patches'),
        },
        ...(await textureIDs(ctx)).map((identifier) => ({
          action: 'source.read' as const,
          target: target(ctx.scope, 'source', 'pack-fix:' + identifier),
        })),
        {
          action: 'generation.run',
          target: target(ctx.scope, 'projection', 'texture-resources'),
        },
      ],
      resultTargets: (_ctx, result) => [artifactRead(result.artifact)],
      inputs: vector,
      available: () => native.available(),
      async execute(ctx) {
        async function recheck() {
          if (canonical(await vector(ctx)) !== canonical(ctx.inputRevisions))
            throw new WorkspaceError(
              'REVISION_CONFLICT',
              'Texture inputs changed; the displayed previews were kept.',
              'after-refresh',
            )
          await ctx.authorize()
        }
        await recheck()
        const environment = (await environments.resolve(ctx.registration, ctx))
          .manifest
        const provenance = {
          scope: ctx.scope,
          profile: environment.resources.profileId,
          minecraft: environment.selected.minecraft,
          loader: environment.selected.loader,
          adapter: 'selected-resource-generation',
          adapterVersion: 1,
          inputRevision: hash(canonical(ctx.inputRevisions)),
        }
        const staging = await operationStaging(ctx, 'textures')
        try {
          await native.run(ctx, 'textures.generate', {}, { staging })
          const files = await assetProjectionFiles(staging)
          const index = JSON.parse(
            await fs.readFile(files['index.json'], 'utf8'),
          )
          if (index.schema !== 1 || !Array.isArray(index.resources))
            throw new WorkspaceError(
              'GENERATION_FAILED',
              'Texture index is invalid',
            )
          const generation = await artifacts.publish(ctx, {
            namespace: 'texture-resources',
            staging,
            files,
            inputs: { ...ctx.inputRevisions },
            recheck,
            rewriteJSON: (value, references, logical) =>
              scopedResourceLinks(
                '/generated/texture-resources/',
                logical === 'index.json'
                  ? {
                      ...(value as Record<string, unknown>),
                      environment: provenance,
                    }
                  : value,
                references,
              ),
          })
          return {
            artifact: generation.files['index.json'],
            output: 'Texture previews refreshed',
          }
        } finally {
          await disposeStaging(ctx, staging)
        }
      },
    }),
  ]
}
