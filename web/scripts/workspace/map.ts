import { z } from 'zod'
import { domains, validateDomain } from '../../src/lib/domains.mjs'
import { digestSchema } from '../../src/lib/workspace/contracts.ts'
import { defineOperation, type Registration } from './service.ts'
import { createSourceRepository } from './files.ts'
import { target, scopeKey } from './policy.ts'
import { WorkspaceError } from './errors.ts'
import { canonical, hash } from './identity.ts'

const sourceSchema = z.strictObject({
  text: z.string(),
  revision: digestSchema,
})
const sourcesSchema = z.strictObject({
  files: z.record(z.string(), sourceSchema),
  revision: digestSchema,
})
const saveSchema = z.strictObject({
  name: z.enum(domains),
  text: z.string().max(1_000_000),
  revision: digestSchema,
})

export function mapDefinitions(registrations: Registration[]) {
  const repositories = new Map(
    registrations.map((registration) => [
      scopeKey(registration.scope),
      createSourceRepository(registration),
    ]),
  )
  const repository = (registration: Registration) =>
    repositories.get(scopeKey(registration.scope))!
  return [
    defineOperation({
      name: 'map.sources.read',
      effect: 'query',
      input: z.strictObject({}),
      output: sourcesSchema,
      resultTargets: (ctx, value) =>
        Object.keys(value.files).map((name) => ({
          action: 'source.read',
          target: target(ctx.scope, 'source', 'map:' + name),
        })),
      label: 'Read map sources',
      href: '/',
      success: 'Map sources loaded.',
      targets: () => [],
      async execute(context) {
        const sources = repository(context.registration)
        const ids = []
        for (const id of await sources.list('map'))
          if (
            await context.can({
              action: 'source.read',
              target: target(context.scope, 'source', id),
            })
          )
            ids.push(id)
        const result = await sources.snapshot(ids)
        // Re-evaluate granular reads after IO, before returning names/counts.
        for (const id of Object.keys(result.files))
          if (
            !(await context.can({
              action: 'source.read',
              target: target(context.scope, 'source', id),
            }))
          )
            delete result.files[id]
        return {
          ...result,
          revision: hash(
            canonical(
              Object.fromEntries(
                Object.entries(result.files).map(([id, source]) => [
                  id,
                  source.revision,
                ]),
              ),
            ),
          ),
          files: Object.fromEntries(
            Object.entries(result.files).map(([id, value]) => [
              id.slice(4),
              value,
            ]),
          ),
        }
      },
    }),
    defineOperation({
      name: 'map.source.save',
      effect: 'source-write',
      input: saveSchema,
      output: z.strictObject({
        revision: digestSchema,
        sourceSaved: z.literal(true),
      }),
      label: 'Save map source',
      href: '/',
      success: 'Map source saved.',
      targets: (context, input) => [
        {
          action: 'source.read',
          target: target(context.scope, 'source', 'map:' + input.name),
        },
        {
          action: 'source.write',
          target: target(context.scope, 'source', 'map:' + input.name),
        },
      ],
      async inputs(context, input) {
        const id = 'map:' + input.name
        return {
          [id]: (await repository(context.registration).read(id)).revision,
        }
      },
      async execute(context, input) {
        const sources = repository(context.registration),
          id = 'map:' + input.name
        const before = await sources.snapshot([id])
        if (before.files[id].revision !== input.revision)
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Source changed; your draft has been kept.',
            'after-refresh',
          )
        try {
          validateDomain(input.name, input.text)
        } catch (error) {
          throw new WorkspaceError(
            'INVALID_INPUT',
            error instanceof Error
              ? error.message.slice(0, 4096)
              : 'Invalid source',
          )
        }
        const saved = await sources.commit(
          { [id]: input.text },
          before,
          context,
        )
        context.invalidate(
          'sources',
          [
            {
              action: 'source.read',
              target: target(context.scope, 'source', id),
            },
          ],
          { kind: 'invalidated', sources: [id] },
        )
        return {
          revision: saved.files[id].revision,
          sourceSaved: true as const,
        }
      },
    }),
  ]
}
