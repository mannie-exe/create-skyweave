import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { createSnapshotInputs } from './snapshot-inputs.ts'
import {
  defineOperation,
  type Registration,
  type Execution,
} from './service.ts'
import type { NativeExecutor } from './native.ts'
import type { EnvironmentResolver } from './environment.ts'
import type { createArtifactStore } from './artifacts.ts'
import { target } from './policy.ts'
import { ownedDirectory } from './paths.ts'
import { loadedTool } from './loaded-tool.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { compileInputs } from '../compile.mjs'
import { stageMapIcons, mapIconFiles } from './map-assets.ts'
import {
  assetProjectionFiles,
  scopedResourceLinks,
} from './asset-projection.ts'
import { createInputDigests } from './digests.ts'

const ownRevision = loadedTool(import.meta.url)

export function snapshotDefinitions(
  registrations: Registration[],
  native: NativeExecutor,
  artifacts: ReturnType<typeof createArtifactStore>,
  environments: EnvironmentResolver,
) {
  const inputs = createSnapshotInputs(registrations, environments)
  const digest = createInputDigests()
  async function vector(
    ctx: Parameters<typeof inputs.vector>[0],
    refresh: boolean,
    previous = true,
  ) {
    return {
      ...(await inputs.vector(ctx, refresh, previous)),
      'tool:snapshot': await ownRevision(),
      'tool:artifacts': await artifacts.revision(),
      'tool:generated-inputs': hash(
        await fs.readFile(new URL('./generated.ts', import.meta.url)),
      ),
    }
  }
  async function recheck(ctx: Execution, refresh: boolean) {
    const expected = { ...ctx.inputRevisions }
    if (refresh) delete expected['previous:generated']
    if (canonical(await vector(ctx, refresh, !refresh)) !== canonical(expected))
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Capture inputs changed; the previous snapshot was kept.',
        'after-refresh',
      )
    await ctx.authorize()
  }
  return [
    defineOperation({
      name: 'snapshot.check',
      effect: 'inspect',
      input: z.strictObject({}),
      output: z.strictObject({
        stale: z.boolean(),
        changedDuringExport: z.boolean(),
      }),
      label: 'Check implementation',
      href: '/',
      success: 'Implementation inputs checked.',
      targets: async (ctx) => [
        ...(await inputs.targets(ctx, false)),
        {
          action: 'preview.run',
          target: target(ctx.scope, 'projection', 'snapshot-status'),
        },
      ],
      inputs: (ctx) => vector(ctx, false),
      available: () => native.available(),
      async execute(ctx) {
        await recheck(ctx, false)
        let previous: {
          sourceFingerprint?: string
          sourceChangedDuringExport?: boolean
        } | null = null
        try {
          previous = JSON.parse(
            await fs.readFile(
              path.join(
                ctx.registration.web,
                'data/generated/runtime/snapshot.json',
              ),
              'utf8',
            ),
          )
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        const current = (
          await native.run(ctx, 'snapshot.fingerprint')
        ).stdout.trim()
        if (!/^[a-f0-9]{64}$/.test(current))
          throw new WorkspaceError(
            'GENERATION_FAILED',
            'Invalid source fingerprint',
          )
        await recheck(ctx, false)
        return {
          stale: current !== previous?.sourceFingerprint,
          changedDuringExport: previous?.sourceChangedDuringExport === true,
        }
      },
    }),
    defineOperation({
      name: 'snapshot.refresh',
      effect: 'generate',
      input: z.strictObject({}),
      output: z.strictObject({
        generationId: z.uuid(),
        inputRevision: z.string().regex(/^[a-f0-9]{64}$/),
        refreshed: z.literal(true),
      }),
      label: 'Refresh implementation',
      href: '/',
      success:
        'Implementation refreshed. World surveys retain their separate date.',
      targets: async (ctx) => [
        ...(await inputs.targets(ctx, true)),
        {
          action: 'snapshot.capture',
          target: target(ctx.scope, 'projection', 'runtime'),
        },
        {
          action: 'generation.run',
          target: target(ctx.scope, 'projection', 'map'),
        },
      ],
      inputs: (ctx) => vector(ctx, true),
      available: () => native.available(),
      async execute(ctx) {
        await recheck(ctx, true)
        const before = await inputs.dataset(ctx).inventory()
        if (
          inputs.dataset(ctx).revision(before) !==
          ctx.inputRevisions['previous:generated']
        )
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Generated inputs changed before capture.',
            'after-refresh',
          )
        const staging = await operationStaging(ctx, 'snapshot')
        const generated = path.join(staging, 'data'),
          runtime = path.join(generated, 'runtime'),
          icons = path.join(staging, 'icons'),
          capture = path.join(staging, 'capture'),
          map = path.join(staging, 'map')
        try {
          await inputs.dataset(ctx).copy(before, generated)
          await fs.rm(runtime, { recursive: true, force: true })
          for (const folder of [runtime, icons, capture, map])
            await fs.mkdir(folder, { recursive: true })
          const environment = await environments.resolve(ctx.registration, ctx)
          const observation =
            canonical(environment.trusted.configured) +
            canonical(environment.trusted.executables)
          async function stable() {
            await recheck(ctx, true)
            const current = await environments.resolve(ctx.registration, ctx)
            if (
              canonical(current.trusted.configured) +
                canonical(current.trusted.executables) !==
              observation
            )
              throw new WorkspaceError(
                'REVISION_CONFLICT',
                'Capture tool configuration changed.',
                'after-refresh',
              )
          }
          await native.run(ctx, 'snapshot.capture', {}, { runtime, capture })
          const completed = JSON.parse(
            await fs.readFile(path.join(runtime, 'complete.json'), 'utf8'),
          )
          const snapshot = JSON.parse(
            await fs.readFile(path.join(runtime, 'snapshot.json'), 'utf8'),
          )
          const errors = JSON.parse(
            await fs.readFile(path.join(runtime, 'errors.json'), 'utf8'),
          )
          if (
            completed.minecraft !== environment.manifest.selected.minecraft ||
            snapshot.lockSha256 !== ctx.inputRevisions['pack:lock'] ||
            !Array.isArray(errors) ||
            errors.length
          )
            throw new WorkspaceError(
              'GENERATION_FAILED',
              'Runtime capture is incomplete or contains exporter errors',
            )
          if (snapshot.sourceChangedDuringExport)
            throw new WorkspaceError(
              'REVISION_CONFLICT',
              'Inputs changed during runtime capture.',
              'after-refresh',
            )
          await stable()
          await native.run(
            ctx,
            'snapshot.extract',
            {},
            { runtime, generated, icons, capture },
          )
          for (const name of compileInputs.filter((name) =>
            name.startsWith('runtime/'),
          ))
            JSON.parse(
              await fs.readFile(path.join(generated, name + '.json'), 'utf8'),
            )
          await stable()
          await native.run(ctx, 'map.compile', {}, { generated, staging: map })
          await stageMapIcons(generated, icons, map)
          const files = await assetProjectionFiles(map, 'catalog.json', 'map')
          for (const name of [
            'catalog.json',
            'domains.json',
            'routes.json',
            'authored.json',
          ])
            if (!files[name])
              throw new WorkspaceError(
                'GENERATION_FAILED',
                'Compiled map is incomplete',
              )
          // Immutable icon names may be added before the directory switch; no active map refers to them yet.
          const publicIcons = await ownedDirectory(
            await fs.realpath(ctx.registration.web),
            'public/generated/icons',
          )
          for (const [logical, file] of Object.entries(
            (await mapIconFiles(generated, icons)).files,
          )) {
            const destination = path.join(publicIcons, path.basename(logical))
            await ctx.authorize()
            try {
              await fs.copyFile(file, destination, fs.constants.COPYFILE_EXCL)
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
                throw error
            }
            if (
              (await digest(destination)).sha256 !== (await digest(file)).sha256
            )
              throw new WorkspaceError(
                'REVISION_CONFLICT',
                'An existing icon changed. It was not replaced.',
                'after-refresh',
              )
          }
          await stable()
          const published = await inputs
            .dataset(ctx)
            .replace(ctx, generated, before, () =>
              artifacts.publish(ctx, {
                namespace: 'map',
                jsonMaximum: 32,
                staging: map,
                files,
                inputs: { ...ctx.inputRevisions },
                recheck: stable,
                rewriteJSON: (value, references) =>
                  scopedResourceLinks('/generated/', value, references),
              }),
            )
          ctx.invalidate(
            'environment',
            [
              {
                action: 'environment.read',
                target: target(ctx.scope, 'environment', 'current'),
              },
            ],
            { kind: 'runtime-captured' },
          )
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
  ]
}
