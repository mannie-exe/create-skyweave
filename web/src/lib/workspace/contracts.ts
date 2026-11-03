import { z } from 'zod'

export const limits = {
  incoming: 1_100_000,
  document: 1_000_000,
  outgoing: 256 * 1024,
  depth: 64,
  outstanding: 16,
  subscriptions: 16,
  receipts: 512,
  receiptAge: 30 * 60_000,
  commandAge: 30_000,
  history: 20,
} as const

const identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
export const scopeSchema = z.strictObject({
  workspaceId: identifier,
  packId: identifier,
})
export type Scope = z.infer<typeof scopeSchema>
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const actionSchema = z.enum([
  'pack.read',
  'source.read',
  'source.write',
  'preview.run',
  'generation.run',
  'snapshot.capture',
  'environment.read',
  'operation.read',
  'operation.cancel',
  'artifact.read',
  'review.write',
])
export type Action = z.infer<typeof actionSchema>
export const targetSchema = scopeSchema.extend({
  kind: z.enum([
    'pack',
    'source',
    'projection',
    'artifact',
    'operation',
    'environment',
  ]),
  id: z.string().min(1).max(240),
})
export type Target = z.infer<typeof targetSchema>
const effectSchema = z.enum([
  'query',
  'inspect',
  'preview',
  'source-write',
  'generate',
  'download',
  'control',
])
export type Effect = z.infer<typeof effectSchema>
const topics = ['activity', 'environment', 'sources', 'projections'] as const
const topicSchema = z.enum(topics)
export type Topic = z.infer<typeof topicSchema>

const errorCodeSchema = z.enum([
  'INVALID_INPUT',
  'NOT_FOUND',
  'FORBIDDEN',
  'UNSUPPORTED_PROTOCOL',
  'CAPABILITY_UNAVAILABLE',
  'BUSY',
  'CAPACITY_REACHED',
  'REVISION_CONFLICT',
  'COMMAND_ID_CONFLICT',
  'OUTCOME_UNKNOWN',
  'SESSION_CHANGED',
  'SOURCE_PARTIAL',
  'GENERATION_FAILED',
  'CANCEL_NOT_SUPPORTED',
  'CANCELLED',
  'STORAGE_UNAVAILABLE',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>
const recoverySchema = z.enum([
  'never',
  'after-refresh',
  'after-idle',
  'reconnect',
  'inspect-outcome',
])
export type Recovery = z.infer<typeof recoverySchema>
const failureSchema = z.strictObject({
  code: errorCodeSchema,
  message: z.string().max(4096),
  recovery: recoverySchema,
  details: z.record(z.string(), z.unknown()).optional(),
})
export type Failure = z.infer<typeof failureSchema>

/** Guard opaque domain JSON before schema traversal or hashing. */
export function assertJson(
  value: unknown,
  maximum: number = limits.document,
): void {
  const queue: Array<[unknown, number, boolean]> = [[value, 0, false]]
  const ancestors = new Set<object>()
  let nodes = 0
  while (queue.length) {
    const [item, depth, leaving] = queue.pop()!
    if (leaving) {
      ancestors.delete(item as object)
      continue
    }
    if (++nodes > limits.document) throw new Error('JSON is too complex')
    if (depth > limits.depth) throw new Error('JSON nesting exceeds 64 levels')
    if (item === null || typeof item === 'string' || typeof item === 'boolean')
      continue
    if (typeof item === 'number' && Number.isFinite(item)) continue
    if (typeof item !== 'object') throw new Error('Expected JSON values')
    if (ancestors.has(item)) throw new Error('Cyclic JSON is not supported')
    ancestors.add(item)
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype
    )
      throw new Error('Expected a JSON object')
    queue.push([item, depth, true])
    for (const child of Object.values(item))
      queue.push([child, depth + 1, false])
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximum)
    throw new Error('JSON exceeds the permitted size')
}

export const artifactSchema = z.strictObject({
  id: digestSchema,
  scope: scopeSchema,
  generationId: z.string().min(1).max(100),
  mediaType: z.string().min(1).max(100),
  byteLength: z.number().int().nonnegative(),
  sha256: digestSchema,
  inputRevision: digestSchema,
  url: z.string().startsWith('/__atlas/workspaces/').max(320),
})
export type Artifact = z.infer<typeof artifactSchema>
// Static references are a separate delivery contract, never service-store identities.
export const snapshotArtifactSchema = artifactSchema.extend({
  url: z
    .string()
    .regex(
      /^\/workspace-snapshot\/[a-z0-9][a-z0-9_-]{0,63}\/[a-z0-9][a-z0-9_-]{0,63}\/assets\/[a-f0-9]{64}-[a-f0-9]{64}\.(?:json|png|svg)$/,
    ),
})

export const recoverySnapshotSchema = z.strictObject({
  revision: digestSchema,
  truncated: z.boolean(),
  entries: z
    .array(
      z.strictObject({
        id: digestSchema,
        kind: z.enum([
          'process',
          'source-transaction',
          'generated-inputs',
          'staging',
          'artifact-lock',
        ]),
        state: z.enum(['running', 'interrupted', 'unknown', 'needs-review']),
        label: z.string().min(1).max(120),
        canClean: z.boolean(),
        operationId: z.uuid().optional(),
        sources: z.array(z.string().max(240)).max(512),
      }),
    )
    .max(100),
})
export type RecoverySnapshot = z.infer<typeof recoverySnapshotSchema>
// Ephemeral control replies. Unlike generated artifacts these expire with the service.
export const resultReferenceSchema = z.strictObject({
  id: z.uuid(),
  scope: scopeSchema,
  byteLength: z
    .number()
    .int()
    .nonnegative()
    .max(16 * 1024 * 1024),
  sha256: digestSchema,
  url: z.string().startsWith('/__atlas/workspaces/').max(320),
})
export type ResultReference = z.infer<typeof resultReferenceSchema>
export const environmentSchema = z.strictObject({
  schema: z.literal(1),
  scope: scopeSchema,
  revision: digestSchema,
  selected: z.strictObject({
    minecraft: z.string().max(80),
    loader: z.strictObject({
      id: z.string().max(80),
      version: z.string().max(80),
    }),
    lockSha256: digestSchema,
    intentMatchesLock: z.boolean(),
  }),
  dependencies: z
    .array(
      z.strictObject({
        id: z.string().max(160),
        version: z.string().max(160).nullable(),
        digests: z.array(z.record(z.string(), z.string().max(128))).max(20),
      }),
    )
    .max(1000),
  resources: z.strictObject({
    profileId: z.string().max(80).nullable(),
    packFormat: z.number().int().nullable(),
    dataFormat: z.number().int().nullable(),
    stackRevision: digestSchema,
    stack: z.array(z.string().max(200)).max(500),
  }),
  observed: z
    .strictObject({
      snapshotId: digestSchema,
      inputSha256: digestSchema,
      capturedAt: z.string().max(100).nullable(),
      minecraft: z.string().max(80).nullable(),
      currentLock: z.boolean(),
    })
    .nullable(),
  tools: z
    .array(
      z.strictObject({
        id: z.enum(['node', 'python', 'java', 'javac', 'empack']),
        available: z.boolean(),
        version: z.string().max(100).nullable(),
      }),
    )
    .max(5),
  capabilities: z
    .array(
      z.strictObject({
        id: z.string().max(80),
        adapter: z.string().max(80),
        adapterVersion: z.number().int().positive(),
        state: z.enum(['supported', 'unavailable', 'unsupported', 'stale']),
        evidence: z.enum(['declared', 'inspected', 'runtime']),
        inputRevision: digestSchema,
        reason: z.string().max(4096),
      }),
    )
    .max(40),
})
export type Environment = z.infer<typeof environmentSchema>
const jobSchema = z.strictObject({
  id: z.string().min(1).max(100),
  name: z.string().max(100),
  state: z.string().max(30),
  cancellable: z.boolean(),
  diagnostic: z.string().max(16000).optional(),
})
export const operationSchema = z.strictObject({
  id: z.uuid(),
  commandId: z.uuid(),
  scope: scopeSchema,
  name: z.string().max(80),
  effect: effectSchema,
  label: z.string().max(160),
  href: z.string().startsWith('/').max(240),
  state: z.enum(['running', 'succeeded', 'failed', 'cancelled', 'unknown']),
  message: z.string().max(4096),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  inputs: z.record(z.string(), digestSchema),
  stages: z
    .array(
      z.strictObject({
        name: z.string().max(100),
        committed: z.boolean(),
        revisions: z.record(z.string(), digestSchema).optional(),
      }),
    )
    .max(32),
  job: jobSchema.optional(),
  result: z.unknown().optional(),
  error: failureSchema.optional(),
})
export type Operation = z.infer<typeof operationSchema>
export const activityOperationSchema = operationSchema
  .omit({ inputs: true, stages: true, job: true, result: true, error: true })
  .extend({
    inputsRevision: digestSchema,
    inputCount: z.number().int().nonnegative(),
    stages: z
      .array(
        z.strictObject({ name: z.string().max(100), committed: z.boolean() }),
      )
      .max(32),
    stageCount: z.number().int().nonnegative(),
    stagesTruncated: z.boolean(),
    job: jobSchema
      .extend({ diagnosticTruncated: z.boolean().optional() })
      .optional(),
  })
export type ActivityOperation = z.infer<typeof activityOperationSchema>
export const activitySnapshotSchema = z.strictObject({
  session: z.uuid(),
  current: activityOperationSchema.nullable(),
  history: z.array(activityOperationSchema).max(limits.history),
})

export function boundedText(value: string, maximum: number) {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length <= maximum) return value
  let end = maximum
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--
  return new TextDecoder().decode(bytes.subarray(0, end))
}

const envelope = { v: z.literal(1), requestId: z.uuid(), scope: scopeSchema }
const operationName = z
  .string()
  .regex(/^[a-z]+(?:\.[a-z]+)+$/)
  .max(80)
const querySchema = z.strictObject({
  ...envelope,
  type: z.literal('query'),
  operation: operationName,
  payload: z.unknown(),
})
export const commandSchema = z.strictObject({
  ...envelope,
  type: z.literal('command'),
  operation: operationName,
  commandId: z.uuid(),
  session: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  payload: z.unknown(),
})
export type Command = z.infer<typeof commandSchema>
const clientFrameSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...envelope, type: z.literal('hello') }),
  querySchema,
  commandSchema,
  z.strictObject({
    ...envelope,
    type: z.literal('subscribe'),
    topics: z.array(topicSchema).min(1).max(limits.subscriptions),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('unsubscribe'),
    subscriptionIds: z.array(z.uuid()).max(limits.subscriptions),
  }),
])
export type ClientFrame = z.infer<typeof clientFrameSchema>
export const serverFrameSchema = z.discriminatedUnion('type', [
  z.strictObject({
    v: z.literal(1),
    type: z.literal('welcome'),
    requestId: z.uuid(),
    session: z.uuid(),
    serverTime: z.iso.datetime(),
    protocol: z.literal('atlas.v1'),
    scope: scopeSchema,
    capabilities: z.array(z.string().max(80)),
    cursor: z.number().int().nonnegative(),
  }),
  z.strictObject({
    v: z.literal(1),
    type: z.literal('accepted'),
    requestId: z.uuid(),
    commandId: z.uuid(),
    operationId: z.uuid(),
    session: z.uuid(),
  }),
  z.strictObject({
    v: z.literal(1),
    type: z.literal('result'),
    requestId: z.uuid(),
    session: z.uuid(),
    payload: z.unknown(),
    commandId: z.uuid().optional(),
    operationId: z.uuid().optional(),
  }),
  z.strictObject({
    v: z.literal(1),
    type: z.literal('result-reference'),
    requestId: z.uuid(),
    session: z.uuid(),
    reference: resultReferenceSchema,
    commandId: z.uuid().optional(),
    operationId: z.uuid().optional(),
  }),
  z.strictObject({
    v: z.literal(1),
    type: z.literal('event'),
    session: z.uuid(),
    subscriptionId: z.uuid(),
    scope: scopeSchema,
    topic: topicSchema,
    sequence: z.number().int().positive(),
    payload: z.unknown(),
  }),
  z.strictObject({
    v: z.literal(1),
    type: z.literal('error'),
    requestId: z.uuid().optional(),
    session: z.uuid().optional(),
    commandId: z.uuid().optional(),
    operationId: z.uuid().optional(),
    error: failureSchema,
  }),
  z.strictObject({
    v: z.literal(1),
    type: z.literal('resync'),
    session: z.uuid(),
    scope: scopeSchema,
    topic: topicSchema,
    reason: z.enum(['gap', 'policy', 'capacity', 'publication']),
  }),
])
export type ServerFrame = z.infer<typeof serverFrameSchema>

export const bootstrapSchema = z.strictObject({
  mode: z.enum(['open-local', 'service']),
  scope: scopeSchema,
  protocol: z.literal('atlas.v1'),
  socketPath: z.literal('/__atlas/ws'),
})
export const subscriptionSnapshotSchema = z.strictObject({
  subscriptions: z
    .array(
      z.strictObject({
        id: z.uuid(),
        topic: topicSchema,
        sequence: z.number().int().nonnegative(),
        snapshot: z.unknown(),
      }),
    )
    .max(limits.subscriptions),
})

export function parseClientFrame(text: string): ClientFrame {
  if (new TextEncoder().encode(text).byteLength > limits.incoming)
    throw new Error('Message exceeds the permitted size')
  const value: unknown = JSON.parse(text)
  assertJson(value, limits.incoming)
  return clientFrameSchema.parse(value)
}
