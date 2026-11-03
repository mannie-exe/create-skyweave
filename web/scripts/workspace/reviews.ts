import { z } from 'zod'
import { createComparisons } from '../../src/lib/resource-comparisons.mjs'
import { reviewSnapshot, reviewText } from '../resource-reviews.mjs'
import { digestSchema } from '../../src/lib/workspace/contracts.ts'
import { createSourceRepository } from './files.ts'
import { defineOperation, type Registration, type Resolved } from './service.ts'
import { scopeKey, target } from './policy.ts'
import { WorkspaceError } from './errors.ts'

const ids = ['reviews', 'review-media', 'resource-selections']
const snapshotSchema = z.strictObject({
  document: z.strictObject({
    schema: z.literal(1),
    // Retain dated notes even after their comparison catalogue is retired.
    reviews: z.record(z.string(), z.unknown()),
  }),
  revision: digestSchema,
  evidence: digestSchema,
})

export function reviewDefinitions(registrations: Registration[]) {
  const repositories = new Map(
    registrations.map((registration) => [
      scopeKey(registration.scope),
      createSourceRepository(registration),
    ]),
  )
  const repository = (ctx: Resolved) => repositories.get(scopeKey(ctx.scope))!
  const reads = (ctx: Resolved) =>
    ids.map((id) => ({
      action: 'source.read' as const,
      target: target(ctx.scope, 'source', id),
    }))
  async function read(ctx: Resolved) {
    const sources = await repository(ctx).snapshot(ids)
    try {
      const catalogue = createComparisons(
        JSON.parse(sources.files['review-media'].text),
      )
      const selections = JSON.parse(sources.files['resource-selections'].text)
      if (selections.schema !== 1 || !Array.isArray(selections.selections))
        throw new Error('Invalid selections')
      return {
        sources,
        catalogue,
        selections: selections.selections,
        snapshot: reviewSnapshot(sources.files.reviews.text, catalogue),
      }
    } catch {
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Review source or capture catalogue is invalid',
      )
    }
  }
  return [
    defineOperation({
      name: 'reviews.read',
      effect: 'query',
      input: z.strictObject({}),
      output: snapshotSchema.extend({
        catalogue: z.array(z.unknown()).max(100),
        selections: z.array(z.unknown()).max(1000),
      }),
      label: 'Read resource reviews',
      href: '/resourcepacks/reviews',
      success: '',
      targets: reads,
      resultTargets: reads,
      execute: async (ctx) => {
        const current = await read(ctx)
        const catalogue = current.catalogue.filter(
          (feature) =>
            feature.captures.length &&
            feature.captures.every((capture) => capture.originals.length >= 2),
        )
        if (!catalogue.length)
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            'No captured comparisons are available',
            'after-refresh',
          )
        return {
          ...current.snapshot,
          catalogue,
          selections: current.selections,
        }
      },
    }),
    defineOperation({
      name: 'reviews.save',
      effect: 'source-write',
      input: z.strictObject({
        feature: z.string().regex(/^[a-z0-9_-]{1,80}$/),
        revision: digestSchema,
        evidence: digestSchema,
        review: z.strictObject({
          preference: z.string().max(80),
          notes: z.string().max(4000),
        }),
      }),
      output: snapshotSchema,
      label: 'Save resource review',
      href: '/resourcepacks/reviews',
      success: 'Review saved. Pack selections are unchanged.',
      targets: (ctx) => [
        ...reads(ctx),
        {
          action: 'review.write',
          target: target(ctx.scope, 'source', 'reviews'),
        },
      ],
      resultTargets: reads,
      inputs: async (ctx) =>
        Object.fromEntries(
          Object.entries((await repository(ctx).snapshot(ids)).files).map(
            ([id, source]) => [id, source.revision],
          ),
        ),
      async execute(ctx, input) {
        const before = await read(ctx)
        if (
          before.snapshot.revision !== input.revision ||
          before.snapshot.evidence !== input.evidence ||
          ids.some(
            (id) =>
              before.sources.files[id].revision !== ctx.inputRevisions[id],
          )
        )
          throw new WorkspaceError(
            'REVISION_CONFLICT',
            'Reviews or evidence changed. Reload saved reviews before saving again.',
            'after-refresh',
          )
        let text
        try {
          text = reviewText(before.snapshot, input, before.catalogue)
        } catch (error) {
          throw new WorkspaceError(
            'INVALID_INPUT',
            error instanceof Error ? error.message : 'Invalid review',
          )
        }
        const saved = await repository(ctx).commit(
          { reviews: text },
          before.sources,
          ctx,
        )
        ctx.invalidate('sources', reads(ctx), {
          kind: 'invalidated',
          sources: ['reviews'],
        })
        return reviewSnapshot(saved.files.reviews.text, before.catalogue)
      },
    }),
  ]
}
