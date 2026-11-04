import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { compileInputs } from '../compile.mjs'
import { domains } from '../../src/lib/domains.mjs'
import {
  artifactSchema,
  digestSchema,
} from '../../src/lib/workspace/contracts.ts'
import { createArtifactStore } from './artifacts.ts'
import {
  defineOperation,
  type Registration,
  type Execution,
  type Resolved,
} from './service.ts'
import { artifactRead, target } from './policy.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { validateDomain } from '../../src/lib/domains.mjs'
import type { NativeExecutor } from './native.ts'
import { mapIconFiles, stageMapIcons } from './map-assets.ts'
import {
  assetProjectionFiles,
  scopedResourceLinks,
  assetProjectionRevision,
} from './asset-projection.ts'
import { loadedTool } from './loaded-tool.ts'
const ownRevision = loadedTool(import.meta.url)

type Store = ReturnType<typeof createArtifactStore>
/** Exact bytes of every declared compile input, including implementation/profile. */
export async function mapInputVector(
  registration: Registration,
  options: { scenario?: boolean; capture?: boolean } = {},
) {
  const files: Array<[string, string]> = [
    ...domains.map((name): [string, string] => [
      'map:' + name,
      path.join(registration.web, 'data/authored', name + '.yml'),
    ]),
    ...compileInputs
      .filter(
        (name) =>
          !options.capture || ['world', 'structures', 'islands'].includes(name),
      )
      .map((name): [string, string] => [
        'runtime:' + name,
        path.join(registration.web, 'data/generated', name + '.json'),
      ]),
    [
      'pack:structure-processor',
      path.join(
        registration.pack,
        'pack-fixes/data/skyvillages/worldgen/processor_list/house_processor.json',
      ),
    ],
    ['tool:dependencies', path.join(registration.web, 'pnpm-lock.yaml')],
  ]
  // Local compiler modules are inputs too; the lock identifies package imports.
  const modules = [
    'scripts/compile.mjs',
    'scripts/configuration.mjs',
    ...(options.scenario
      ? ['scripts/export_patch.py', 'scripts/paths.py']
      : []),
    ...(await fs.readdir(path.join(registration.web, 'src/lib')))
      .filter((name) => name.endsWith('.mjs'))
      .map((name) => 'src/lib/' + name),
  ]
  for (const relative of modules)
    files.push(['tool:' + relative, path.join(registration.web, relative)])
  const vector: Record<string, string> = {}
  for (const [id, file] of files) {
    try {
      if ((await fs.realpath(file)) !== file)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Compile input symlinks are not supported',
        )
      vector[id] = hash(await fs.readFile(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      vector['missing:' + id] = hash('')
    }
  }
  if (!options.capture)
    vector['asset:icons'] = (
      await mapIconFiles(
        path.join(registration.web, 'data/generated'),
        path.join(registration.web, 'public/generated/icons'),
      )
    ).revision
  vector['tool:map-projection'] = await ownRevision()
  vector['tool:asset-projection'] = await assetProjectionRevision()
  vector['tool:map-assets'] = hash(
    await fs.readFile(new URL('./map-assets.ts', import.meta.url)),
  )
  return vector
}
export function mapProjectionDefinitions(
  artifacts: Store,
  native: NativeExecutor,
) {
  const grants = (ctx: Resolved) => [
    {
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', 'asset:map-icons'),
    },
    {
      action: 'generation.run' as const,
      target: target(ctx.scope, 'projection', 'map'),
    },
    {
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', 'pack:structure-processor'),
    },
    ...domains.map((name) => ({
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', 'map:' + name),
    })),
    ...compileInputs.map((name) => ({
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', 'runtime:' + name),
    })),
  ]
  async function recheck(ctx: Execution) {
    if (
      canonical(
        await mapInputVector(ctx.registration, {
          scenario: Object.hasOwn(
            ctx.inputRevisions,
            'tool:scripts/export_patch.py',
          ),
        }),
      ) !== canonical(ctx.inputRevisions)
    )
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Map inputs changed; the previous output was kept.',
        'after-refresh',
      )
    await ctx.authorize()
  }
  async function rebuild(ctx: Execution, revision: string, staging: string) {
    await recheck(ctx)
    const sourceVector = Object.fromEntries(
      Object.entries(ctx.inputRevisions).filter(([id]) =>
        id.startsWith('map:'),
      ),
    )
    if (revision !== hash(canonical(sourceVector)))
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Map sources changed before rebuilding',
        'after-refresh',
      )
    await native.run(ctx, 'map.compile', {}, { staging })
    await stageMapIcons(
      path.join(ctx.registration.web, 'data/generated'),
      path.join(ctx.registration.web, 'public/generated/icons'),
      staging,
    )
    const files = await assetProjectionFiles(staging, 'catalog.json', 'map')
    for (const required of [
      'catalog.json',
      'domains.json',
      'routes.json',
      'authored.json',
    ])
      if (!files[required])
        throw new WorkspaceError(
          'GENERATION_FAILED',
          'Map output is incomplete',
        )
    return artifacts.publish(ctx, {
      namespace: 'map',
      jsonMaximum: 32,
      staging,
      files,
      inputs: { ...ctx.inputRevisions },
      recheck: () => recheck(ctx),
      rewriteJSON: (value, references) =>
        scopedResourceLinks('/generated/', value, references),
    })
  }
  async function stage(ctx: Execution) {
    return operationStaging(ctx, 'map')
  }
  return [
    defineOperation({
      name: 'map.compile',
      effect: 'generate',
      input: z.strictObject({ revision: digestSchema }),
      output: z.strictObject({
        generationId: z.uuid(),
        inputRevision: digestSchema,
        refreshed: z.literal(true),
      }),
      label: 'Rebuild map',
      href: '/',
      success: 'Map rebuilt. Runtime evidence preserved.',
      targets: grants,
      inputs: (ctx) => mapInputVector(ctx.registration),
      available: () => native.available(),
      async execute(ctx, input) {
        const staging = await stage(ctx)
        try {
          const published = await rebuild(ctx, input.revision, staging)
          return {
            generationId: published.id,
            inputRevision: published.inputRevision,
            refreshed: true as const,
          }
        } finally {
          await disposeStaging(ctx, staging)
        }
      },
    }),
    defineOperation({
      name: 'scenario.export',
      effect: 'generate',
      input: z.strictObject({ revision: digestSchema }),
      output: artifactSchema,
      resultTargets: (_ctx, reference) => [artifactRead(reference)],
      label: 'Export recipe scenario',
      href: '/',
      success: 'Recipe scenario exported. Instances were not changed.',
      targets: (ctx) => [
        ...grants(ctx),
        {
          action: 'generation.run',
          target: target(ctx.scope, 'projection', 'scenario'),
        },
      ],
      inputs: (ctx) => mapInputVector(ctx.registration, { scenario: true }),
      available: () => native.available(),
      async execute(ctx, input) {
        const staging = await stage(ctx)
        try {
          const mapDirectory = path.join(staging, 'map')
          await fs.mkdir(mapDirectory)
          await rebuild(ctx, input.revision, mapDirectory)
          const scenario = validateDomain(
            'recipes',
            await fs.readFile(
              path.join(ctx.registration.web, 'data/authored/recipes.yml'),
              'utf8',
            ),
          )
          await recheck(ctx)
          await native.run(
            ctx,
            'scenario.export',
            { changes: scenario.changes },
            { staging },
          )
          const file = path.join(staging, 'create-skyweave-atlas-patch.zip')
          const generation = await artifacts.publish(ctx, {
            namespace: 'scenario',
            staging,
            files: { 'create-skyweave-atlas-patch.zip': file },
            inputs: { ...ctx.inputRevisions },
            recheck: () => recheck(ctx),
          })
          return generation.files['create-skyweave-atlas-patch.zip']
        } finally {
          await disposeStaging(ctx, staging)
        }
      },
    }),
  ]
}
