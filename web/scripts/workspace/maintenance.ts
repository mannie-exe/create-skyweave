import { z } from 'zod'
import { defineOperation } from './service.ts'
import { target } from './policy.ts'
import { projectionNamespaces } from './inventory.ts'
import type { createArtifactStore } from './artifacts.ts'

export function artifactMaintenanceDefinitions(
  store: ReturnType<typeof createArtifactStore>,
) {
  const pruneTargets = (ctx: { scope: Parameters<typeof target>[0] }) => [
    {
      action: 'generation.run' as const,
      target: target(ctx.scope, 'projection', 'artifact-retention'),
    },
  ]
  const result = z.strictObject({
    dryRun: z.boolean(),
    generations: z.number().int().nonnegative(),
    references: z.number().int().nonnegative(),
    blobs: z.number().int().nonnegative(),
    temporary: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
  })
  return [
    defineOperation({
      name: 'artifacts.retention',
      effect: 'query',
      input: z.strictObject({}),
      output: result,
      label: 'Review artifact retention',
      href: '/',
      success: '',
      targets: pruneTargets,
      execute: (ctx) => store.prune(ctx, ctx.scope, true),
    }),
    defineOperation({
      name: 'artifacts.prune',
      effect: 'generate',
      input: z.strictObject({}),
      output: result,
      label: 'Clean obsolete artifacts',
      href: '/',
      success: 'Obsolete artifacts cleaned.',
      targets: pruneTargets,
      execute: (ctx) => store.prune(ctx, ctx.scope, false),
    }),
    defineOperation({
      name: 'artifacts.pin',
      effect: 'source-write',
      input: z.strictObject({
        namespace: z.enum(projectionNamespaces),
        generationId: z.uuid(),
        enabled: z.boolean(),
      }),
      output: z.strictObject({ generationId: z.uuid(), pinned: z.boolean() }),
      label: 'Set review retention',
      href: '/resourcepacks/reviews',
      success: 'Review retention updated.',
      targets: (ctx, input) => [
        {
          action: 'review.write',
          target: target(ctx.scope, 'source', 'artifact-pins'),
        },
        {
          action: 'artifact.read',
          target: target(ctx.scope, 'projection', input.namespace),
        },
      ],
      async execute(ctx, input) {
        const result = await store.pin(
          ctx,
          ctx.scope,
          input.namespace,
          input.generationId,
          input.enabled,
        )
        ctx.committed('artifact-review-pin')
        return result
      },
    }),
  ]
}
