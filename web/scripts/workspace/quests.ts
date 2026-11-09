import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  artifactSchema,
  digestSchema,
} from '../../src/lib/workspace/contracts.ts'
import { createSourceRepository, questOutputId } from './files.ts'
import {
  defineOperation,
  type Execution,
  type Registration,
  type Resolved,
} from './service.ts'
import { artifactRead, target, scopeKey, type Grant } from './policy.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import { ownedDirectory } from './paths.ts'
import type { NativeExecutor } from './native.ts'
import type { createArtifactStore } from './artifacts.ts'

const empty = z.strictObject({})
const expected = z.strictObject({ revision: digestSchema })
const changeSet = z.record(z.string(), z.string().nullable())
const saveSchema = z.union([
  z.strictObject({ changes: changeSet, revision: digestSchema }),
  z.strictObject({
    name: z.string().max(160),
    text: z.string(),
    revision: digestSchema,
  }),
])
const diffSchema = z.strictObject({
  changed: z.array(z.string().max(240)).max(100),
  removed: z.array(z.string().max(240)).max(100),
  outputs: z.number().int().nonnegative(),
})
const readSchema = z.strictObject({
  files: z.record(
    z.string(),
    z.strictObject({ text: z.string(), revision: digestSchema }),
  ),
  revision: digestSchema,
  preview: z.strictObject({
    state: z.enum(['current', 'stale', 'unavailable']),
    artifact: artifactSchema.optional(),
  }),
})
type Store = ReturnType<typeof createArtifactStore>

export function questDefinitions(
  registrations: Registration[],
  native: NativeExecutor,
  artifacts: Store,
) {
  const repositories = new Map(
    registrations.map((registration) => [
      scopeKey(registration.scope),
      createSourceRepository(registration, { questOutputs: true }),
    ]),
  )
  const repository = (context: Resolved) =>
    repositories.get(scopeKey(context.scope))!
  async function state(context: Resolved) {
    const sources = repository(context)
    return {
      authored: await sources.snapshot(await sources.list('authoring')),
      outputs: await sources.snapshot(await sources.list('quest-outputs')),
    }
  }
  async function vector(context: Resolved) {
    const current = await state(context)
    const result: Record<string, string> = Object.fromEntries(
      Object.entries({
        ...current.authored.files,
        ...current.outputs.files,
      }).map(([id, file]) => [id, file.revision]),
    )
    for (const script of [
      'generate-quests.py',
      'quests.py',
      'audit-changes.py',
    ]) {
      const file = path.join(context.registration.pack, 'scripts', script)
      if ((await fs.realpath(file)) !== file)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Validator symlinks are not supported',
        )
      result['tool:' + script] = hash(await fs.readFile(file))
    }
    return result
  }
  async function recheck(context: Execution) {
    if (canonical(await vector(context)) !== canonical(context.inputRevisions))
      throw new WorkspaceError(
        'REVISION_CONFLICT',
        'Quest inputs changed during this operation; your draft was kept.',
        'after-refresh',
      )
    await context.authorize()
  }
  async function grants(
    context: Resolved,
    write: string[] = [],
    generate = false,
  ): Promise<Grant[]> {
    const sources = repository(context)
    return [
      ...[
        ...(await sources.list('authoring')),
        ...(await sources.list('quest-outputs')),
      ].map((id): Grant => ({
        action: 'source.read',
        target: target(context.scope, 'source', id),
      })),
      ...write.map((id): Grant => ({
        action: 'source.write',
        target: target(context.scope, 'source', id),
      })),
      ...(generate
        ? [
            {
              action: 'generation.run' as const,
              target: target(context.scope, 'projection', 'quests'),
            },
          ]
        : []),
    ]
  }
  function changes(input: z.infer<typeof saveSchema>) {
    return 'changes' in input ? input.changes : { [input.name]: input.text }
  }
  function validChanges(input: z.infer<typeof saveSchema>, quests: boolean) {
    const value = changes(input),
      names = Object.keys(value)
    if (!names.length || names.length > (quests ? 100 : 1))
      throw new WorkspaceError(
        'INVALID_INPUT',
        quests
          ? 'Expected quest source changes'
          : 'Expected one configuration register',
      )
    if (
      names.some((name) =>
        quests
          ? !/^quests\/(book\.json|(?:chapters|locales)\/[a-z0-9_]+\.json)$/.test(
              name,
            )
          : !/^changes\/[a-z0-9_]+\.json$/.test(name),
      )
    )
      throw new WorkspaceError('INVALID_INPUT', 'Unknown authoring file')
    for (const text of Object.values(value))
      if (text !== null) {
        try {
          JSON.parse(text)
        } catch {
          throw new WorkspaceError(
            'INVALID_INPUT',
            'Source must contain valid JSON',
          )
        }
      }
    return value
  }
  async function stage(
    context: Execution,
    current: Awaited<ReturnType<typeof state>>,
    edits: Record<string, string | null> = {},
  ) {
    const directory = await operationStaging(context, 'quests')
    try {
      const files: Record<string, string> = Object.fromEntries(
        Object.entries(current.authored.files).map(([name, source]) => [
          'authoring/' + name,
          source.text,
        ]),
      )
      for (const [id, source] of Object.entries(current.outputs.files))
        files[
          path.relative(
            await fs.realpath(context.registration.pack),
            await repository(context).location(id),
          )
        ] = source.text
      for (const [id, text] of Object.entries(edits)) {
        if (text === null) delete files['authoring/' + id]
        else files['authoring/' + id] = text
      }
      for (const [relative, text] of Object.entries(files)) {
        const folder = path.dirname(relative)
        if (folder !== '.') await ownedDirectory(directory, folder)
        await fs.writeFile(path.join(directory, relative), text, { flag: 'wx' })
      }
      return directory
    } catch (error) {
      await disposeStaging(context, directory)
      throw error
    }
  }
  async function previewArtifact(
    context: Execution,
    directory: string,
    diff: z.infer<typeof diffSchema>,
    inputs: Record<string, string>,
    check: () => Promise<void>,
  ) {
    const file = path.join(directory, 'diff.json')
    await fs.writeFile(file, JSON.stringify(diff))
    const generation = await artifacts.publish(context, {
      namespace: 'quests-preview',
      staging: directory,
      files: { 'diff.json': file },
      inputs,
      recheck: check,
    })
    return generation.files['diff.json']
  }
  async function snapshot(context: Execution) {
    const sources = repository(context),
      ids = []
    for (const id of await sources.list('authoring'))
      if (
        await context.can({
          action: 'source.read',
          target: target(context.scope, 'source', id),
        })
      )
        ids.push(id)
    const current = await sources.snapshot(ids)
    for (const id of Object.keys(current.files))
      if (
        !(await context.can({
          action: 'source.read',
          target: target(context.scope, 'source', id),
        }))
      )
        delete current.files[id]
    let preview: z.infer<typeof readSchema>['preview'] = {
      state: 'unavailable',
    }
    if (
      await context.can({
        action: 'artifact.read',
        target: target(context.scope, 'projection', 'quests-preview'),
      })
    ) {
      const saved = await artifacts.active(
        context,
        context.scope,
        'quests-preview',
        'diff.json',
      )
      const reference = saved?.files['diff.json']
      // A full input fingerprint is only read when the caller can read every dependency.
      const full = await grants(context)
      if (
        reference &&
        (await Promise.all(full.map((grant) => context.can(grant)))).every(
          Boolean,
        )
      )
        preview = {
          state:
            hash(canonical(await vector(context))) === reference.inputRevision
              ? 'current'
              : 'stale',
          artifact: reference,
        }
    }
    return { ...current, revision: sources.revision(current.files), preview }
  }
  function saveDefinition(quests: boolean) {
    return defineOperation({
      name: quests ? 'quests.save' : 'config.source.save',
      effect: 'source-write',
      input: saveSchema,
      output: z.strictObject({
        revision: digestSchema,
        sourceSaved: z.literal(true),
      }),
      label: quests ? 'Save quest source' : 'Save configuration source',
      href: quests ? '/authoring' : '/authoring?view=source',
      success: 'Source saved.',
      targets: async (ctx, input) =>
        grants(ctx, Object.keys(validChanges(input, quests))),
      inputs: vector,
      available: () => native.available(),
      async execute(context, input) {
        const sources = repository(context),
          current = await state(context),
          edits = validChanges(input, quests)
        const revision =
          'changes' in input
            ? current.authored.revision
            : current.authored.files[input.name]?.revision
        if (revision !== input.revision)
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Source changed; your draft was kept.',
            'after-refresh',
          )
        await recheck(context)
        const directory = await stage(context, current, edits)
        try {
          await native.run(
            context,
            'quests.validate',
            {},
            { validation: directory },
          )
          await native.run(
            context,
            'config.validate',
            {},
            { validation: directory },
          )
          await recheck(context)
          const saved = await sources.commit(
            edits,
            current.authored,
            context,
            'authoring',
          )
          context.invalidate(
            'sources',
            Object.keys(edits).map((id) => ({
              action: 'source.read',
              target: target(context.scope, 'source', id),
            })),
            { kind: 'invalidated', sources: Object.keys(edits) },
          )
          return {
            revision:
              'changes' in input
                ? saved.revision
                : saved.files[input.name].revision,
            sourceSaved: true as const,
          }
        } finally {
          await disposeStaging(context, directory)
        }
      },
    })
  }
  return [
    defineOperation({
      name: 'quests.read',
      effect: 'query',
      input: empty,
      output: readSchema,
      resultTargets: (ctx, value) => [
        ...Object.keys(value.files).map((id): Grant => ({
          action: 'source.read',
          target: target(ctx.scope, 'source', id),
        })),
        ...(value.preview.artifact
          ? [artifactRead(value.preview.artifact)]
          : []),
      ],
      label: 'Read quest source',
      href: '/authoring',
      success: '',
      targets: () => [],
      execute: snapshot,
    }),
    saveDefinition(true),
    saveDefinition(false),
    defineOperation({
      name: 'quests.preview',
      effect: 'preview',
      input: expected,
      output: artifactSchema,
      resultTargets: (_ctx, value) => [artifactRead(value)],
      label: 'Review quest outputs',
      href: '/authoring',
      success: 'Quest output review ready.',
      targets: async (ctx) => [
        ...(await grants(ctx)),
        {
          action: 'preview.run',
          target: target(ctx.scope, 'projection', 'quests-preview'),
        },
      ],
      inputs: vector,
      available: () => native.available(),
      async execute(context, input) {
        const current = await state(context)
        if (current.authored.revision !== input.revision)
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Source changed before preview',
            'after-refresh',
          )
        await recheck(context)
        const directory = await stage(context, current)
        try {
          const diff = diffSchema.parse(
            JSON.parse(
              (
                await native.run(
                  context,
                  'quests.preview',
                  {},
                  { validation: directory },
                )
              ).stdout,
            ),
          )
          return await previewArtifact(
            context,
            directory,
            diff,
            { ...context.inputRevisions },
            () => recheck(context),
          )
        } finally {
          await disposeStaging(context, directory)
        }
      },
    }),
    defineOperation({
      name: 'quests.generate',
      effect: 'generate',
      input: expected,
      output: z.strictObject({ output: z.string().max(4096) }),
      label: 'Generate FTB Quests files',
      href: '/authoring',
      success: 'FTB Quests files generated. Instances were not changed.',
      targets: (ctx) => grants(ctx, [], true),
      inputs: vector,
      available: () => native.available(),
      async execute(context, input) {
        const sources = repository(context),
          current = await state(context)
        if (current.authored.revision !== input.revision)
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Source changed before generation',
            'after-refresh',
          )
        await recheck(context)
        const directory = await stage(context, current)
        try {
          const diff = diffSchema.parse(
            JSON.parse(
              (
                await native.run(
                  context,
                  'quests.preview',
                  {},
                  { validation: directory },
                )
              ).stdout,
            ),
          )
          await native.run(
            context,
            'quests.generate',
            {},
            { validation: directory },
          )
          const edits: Record<string, string | null> = {}
          for (const relative of diff.changed) {
            const id = questOutputId(relative),
              file = path.join(directory, relative)
            if ((await fs.realpath(file)) !== file)
              throw new WorkspaceError(
                'GENERATION_FAILED',
                'Generated output symlinks are not supported',
              )
            edits[id] = await fs.readFile(file, 'utf8')
          }
          for (const relative of diff.removed)
            edits[questOutputId(relative)] = null
          await recheck(context)
          if (Object.keys(edits).length) {
            await sources.commit(
              edits,
              current.outputs,
              context,
              'quest-outputs',
              'quest-output',
            )
            context.invalidate(
              'sources',
              Object.keys(edits).map((id) => ({
                action: 'source.read',
                target: target(context.scope, 'source', id),
              })),
              { kind: 'invalidated', sources: Object.keys(edits) },
            )
          }
          const after = await vector(context)
          const report = { changed: [], removed: [], outputs: diff.outputs }
          await previewArtifact(context, directory, report, after, async () => {
            if (canonical(await vector(context)) !== canonical(after))
              throw new WorkspaceError(
                'REVISION_CONFLICT',
                'Quest outputs changed after generation',
                'after-refresh',
              )
            await context.authorize()
          })
          return {
            output: `Quests: ${diff.outputs} outputs, ${diff.changed.length} changed, ${diff.removed.length} removed`,
          }
        } finally {
          await disposeStaging(context, directory)
        }
      },
    }),
  ]
}
