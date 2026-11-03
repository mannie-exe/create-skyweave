import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  artifactSchema,
  digestSchema,
} from '../../src/lib/workspace/contracts.ts'
import { createSourceRepository } from './files.ts'
import {
  defineOperation,
  type Execution,
  type Registration,
  type Resolved,
} from './service.ts'
import { artifactRead, target, scopeKey } from './policy.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { createInputDigests } from './digests.ts'
import { createPackOutput } from './pack-output.ts'
import type { NativeExecutor } from './native.ts'
import type { createArtifactStore } from './artifacts.ts'
import { loadedTool } from './loaded-tool.ts'
const modelTool = loadedTool(import.meta.url)

const documentSchema = z.record(z.string(), z.unknown())
const draftSchema = z.strictObject({ document: documentSchema })
const saveSchema = z.strictObject({
  document: documentSchema,
  revision: digestSchema,
})
const expected = z.strictObject({ revision: digestSchema })
const previewSchema = z.strictObject({
  state: z.enum(['current', 'stale', 'unavailable']),
  artifact: artifactSchema.optional(),
  reason: z.string().max(4096).optional(),
})

/** Exact resource sources shared by model and texture generation. */
export function createResourceInputs(registrations: Registration[]) {
  const repositories = new Map(
    registrations.map((registration) => [
      scopeKey(registration.scope),
      createSourceRepository(registration),
    ]),
  )
  const sources = (ctx: Resolved) => repositories.get(scopeKey(ctx.scope))!
  const digest = createInputDigests()
  async function declared(ctx: Resolved) {
    const data = JSON.parse((await sources(ctx).read('resource-pins')).text)
    if (
      !data.sources ||
      typeof data.sources !== 'object' ||
      Array.isArray(data.sources)
    )
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Invalid resource input manifest',
      )
    return Object.entries(data.sources) as Array<
      [string, { path: string; sha512: string }]
    >
  }
  async function grants(ctx: Resolved) {
    const ids = [
      ...(await sources(ctx).list('models')),
      'pack:manifest',
      'pack:lock',
      'pack:bindings',
      ...(await declared(ctx).then((pins) =>
        pins.map(([id]) => 'asset:' + id),
      )),
    ]
    return ids.map((id) => ({
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', id),
    }))
  }
  async function vector(
    ctx: Resolved,
    building = false,
    extraTools: string[] = [],
  ) {
    const repository = sources(ctx),
      root = await fs.realpath(ctx.registration.pack)
    const current = await repository.snapshot([
      ...(await repository.list('models')),
      'pack:manifest',
      'pack:lock',
      'pack:bindings',
    ])
    const values: Record<string, string> = Object.fromEntries(
      Object.entries(current.files).map(([id, value]) => [id, value.revision]),
    )
    values['tool:atlas:models'] = await modelTool()
    for (const [id, pin] of await declared(ctx)) {
      if (
        typeof pin.path !== 'string' ||
        path.isAbsolute(pin.path) ||
        pin.path.split(/[\\/]/).includes('..') ||
        !/^[a-f0-9]{128}$/.test(pin.sha512)
      )
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Invalid pinned resource path or digest',
        )
      try {
        const actual = await digest(path.join(root, pin.path))
        if (actual.sha512 !== pin.sha512)
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            `Pinned resource differs: ${id}`,
            'after-refresh',
          )
        values['asset:' + id] = actual.sha256
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            `Materialize the pinned resource first: ${id}`,
            'after-refresh',
          )
        throw error
      }
    }
    const tools = [
      ...extraTools,
      'model-workbench.py',
      'model_authoring.py',
      'resource_inputs.py',
      ...(building
        ? [
            'build-resource-patches.py',
            'archive_output.py',
            'lootr_models.py',
            'cem_geometry.py',
            'texture_resources.py',
            'lootr_artwork.py',
            'selective_resources.py',
            'window_interiors.py',
            'resource_assets.py',
            'model_transforms.py',
          ]
        : []),
    ]
    for (const name of tools) {
      const file = path.join(root, 'scripts', name)
      if ((await fs.realpath(file)) !== file)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Resource tool symlinks are not supported',
        )
      values['tool:' + name] = hash(await fs.readFile(file))
    }
    if (building)
      values['resource-license:nautilus3d'] = hash(
        await fs.readFile(
          path.join(
            root,
            'authoring/resource-licenses/nautilus3d-AGPL-3.0.txt',
          ),
        ),
      )
    return values
  }
  return { sources, grants, vector }
}

export function modelDefinitions(
  registrations: Registration[],
  native: NativeExecutor,
  artifacts: ReturnType<typeof createArtifactStore>,
) {
  const { sources, grants, vector } = createResourceInputs(registrations)
  const output = createPackOutput()
  async function recheck(ctx: Execution, before = ctx.inputRevisions) {
    const captured = Object.fromEntries(
      Object.entries(before).filter(
        ([id]) =>
          !id.startsWith('draft:') &&
          !id.startsWith('output:') &&
          !id.startsWith('missing:output:'),
      ),
    )
    if (
      canonical(
        await vector(
          ctx,
          Object.hasOwn(before, 'tool:build-resource-patches.py'),
        ),
      ) !== canonical(captured)
    )
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Model or resource inputs changed; the saved output was kept.',
        'after-refresh',
      )
    await ctx.authorize()
  }
  async function stage(ctx: Execution) {
    return operationStaging(ctx, 'models')
  }
  async function snapshot(ctx: Execution) {
    for (const grant of await grants(ctx))
      if (!(await ctx.can(grant)))
        throw new WorkspaceError('NOT_FOUND', 'Model source is unavailable')
    const repository = sources(ctx),
      source = await repository.snapshot(await repository.list('models'))
    const document = JSON.parse(source.files.models.text)
    let preview: z.infer<typeof previewSchema> = { state: 'unavailable' }
    if (
      await ctx.can({
        action: 'artifact.read',
        target: target(ctx.scope, 'projection', 'models-preview'),
      })
    ) {
      const saved = await artifacts.active(
        ctx,
        ctx.scope,
        'models-preview',
        'preview.json',
      )
      const artifact = saved?.files['preview.json']
      if (artifact) {
        try {
          const inputs = {
            ...(await vector(ctx)),
            'draft:model': hash(canonical(document)),
          }
          preview = {
            state:
              hash(canonical(inputs)) === artifact.inputRevision
                ? 'current'
                : 'stale',
            artifact,
          }
        } catch (error) {
          if (
            error instanceof WorkspaceError &&
            error.code === 'CAPABILITY_UNAVAILABLE'
          )
            preview = { state: 'unavailable', reason: error.message }
          else throw error
        }
      }
    }
    return { document, revision: source.revision, preview }
  }
  return [
    defineOperation({
      name: 'models.read',
      effect: 'query',
      input: z.strictObject({}),
      output: z.strictObject({
        document: documentSchema,
        revision: digestSchema,
        preview: previewSchema,
      }),
      label: 'Read model source',
      href: '/resource-authoring?view=models',
      success: '',
      targets: grants,
      execute: snapshot,
      resultTargets: (_ctx, value) =>
        value.preview.artifact ? [artifactRead(value.preview.artifact)] : [],
    }),
    defineOperation({
      name: 'models.preview',
      effect: 'preview',
      input: draftSchema,
      output: artifactSchema,
      label: 'Preview model draft',
      href: '/resource-authoring?view=models',
      success: 'Model preview ready.',
      resultTargets: (_ctx, value) => [artifactRead(value)],
      targets: async (ctx) => [
        ...(await grants(ctx)),
        {
          action: 'preview.run',
          target: target(ctx.scope, 'projection', 'models-preview'),
        },
      ],
      inputs: async (ctx, input) => ({
        ...(await vector(ctx)),
        'draft:model': hash(canonical(input.document)),
      }),
      available: () => native.available(),
      async execute(ctx, input) {
        await recheck(ctx)
        const result = await native.run(ctx, 'models.preview', input)
        const value = JSON.parse(result.stdout)
        if (!Array.isArray(value.previews) || !Array.isArray(value.outputs))
          throw new WorkspaceError(
            'GENERATION_FAILED',
            'Model preview is incomplete',
          )
        const directory = await stage(ctx)
        try {
          const file = path.join(directory, 'preview.json')
          await fs.writeFile(file, JSON.stringify(value))
          const generation = await artifacts.publish(ctx, {
            namespace: 'models-preview',
            staging: directory,
            files: { 'preview.json': file },
            inputs: { ...ctx.inputRevisions },
            recheck: () => recheck(ctx),
          })
          return generation.files['preview.json']
        } finally {
          await disposeStaging(ctx, directory)
        }
      },
    }),
    defineOperation({
      name: 'models.save',
      effect: 'source-write',
      input: saveSchema,
      output: z.strictObject({
        revision: digestSchema,
        sourceSaved: z.literal(true),
      }),
      label: 'Save model source',
      href: '/resource-authoring?view=models',
      success: 'Model source saved.',
      targets: async (ctx) => [
        ...(await grants(ctx)),
        {
          action: 'source.write',
          target: target(ctx.scope, 'source', 'models'),
        },
      ],
      inputs: (ctx) => vector(ctx),
      available: () => native.available(),
      async execute(ctx, input) {
        const repository = sources(ctx),
          before = await repository.snapshot(await repository.list('models'))
        if (before.revision !== input.revision)
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Model source or resource inputs changed; your draft was kept.',
            'after-refresh',
          )
        await recheck(ctx)
        await native.run(ctx, 'models.validate', { document: input.document })
        await recheck(ctx)
        const saved = await repository.commit(
          { models: JSON.stringify(input.document, null, 2) + '\n' },
          before,
          ctx,
          'models',
        )
        ctx.invalidate(
          'sources',
          [
            {
              action: 'source.read',
              target: target(ctx.scope, 'source', 'models'),
            },
          ],
          { kind: 'invalidated', sources: ['models'] },
        )
        return { revision: saved.revision, sourceSaved: true as const }
      },
    }),
    defineOperation({
      name: 'resources.generate',
      effect: 'generate',
      input: expected,
      output: z.strictObject({
        output: z.string().max(4096),
        artifact: artifactSchema,
      }),
      label: 'Generate resource patches',
      href: '/resource-authoring?view=models',
      success: 'Resource patches generated. Instances were not changed.',
      resultTargets: (_ctx, value) => [artifactRead(value.artifact)],
      targets: async (ctx) => [
        ...(await grants(ctx)),
        {
          action: 'source.read',
          target: target(ctx.scope, 'source', 'output:resource-patches'),
        },
        {
          action: 'source.read',
          target: target(ctx.scope, 'source', 'resource-license:nautilus3d'),
        },
        {
          action: 'generation.run',
          target: target(ctx.scope, 'projection', 'resource-build'),
        },
      ],
      inputs: async (ctx) => {
        const before = await output.current(ctx)
        return {
          ...(await vector(ctx, true)),
          [before
            ? 'output:resource-patches'
            : 'missing:output:resource-patches']: before ?? hash(''),
        }
      },
      available: () => native.available(),
      async execute(ctx, input) {
        const current = await sources(ctx).snapshot(
          await sources(ctx).list('models'),
        )
        if (current.revision !== input.revision)
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Source changed before generation',
            'after-refresh',
          )
        await recheck(ctx)
        const directory = await stage(ctx)
        try {
          await native.run(
            ctx,
            'resources.generate',
            {},
            { staging: directory },
          )
          const candidate = path.join(directory, 'resource-patches.zip')
          await native.run(
            ctx,
            'resources.validate',
            {},
            { staging: directory },
          )
          const applied = await output.publish(
            ctx,
            candidate,
            ctx.inputRevisions['output:resource-patches'] ?? null,
            () => recheck(ctx),
          )
          const generation = await artifacts.publish(ctx, {
            namespace: 'resource-build',
            staging: directory,
            files: { 'resource-patches.zip': candidate },
            inputs: { ...ctx.inputRevisions },
            async recheck() {
              await recheck(ctx)
              if ((await output.current(ctx)) !== applied)
                throw new WorkspaceError(
                  'REVISION_CONFLICT',
                  'Resource patches changed after publication',
                  'after-refresh',
                )
            },
          })
          return {
            output: 'Resource patches generated',
            artifact: generation.files['resource-patches.zip'],
          }
        } finally {
          await disposeStaging(ctx, directory)
        }
      },
    }),
  ]
}
