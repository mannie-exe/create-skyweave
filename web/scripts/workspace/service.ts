import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  assertJson,
  commandSchema,
  limits,
  operationSchema,
  activityOperationSchema,
  activitySnapshotSchema,
  boundedText,
  scopeSchema,
  type Command,
  type Effect,
  type Operation,
  type Scope,
  type Topic,
} from '../../src/lib/workspace/contracts.ts'
import { WorkspaceError, failure, invalid } from './errors.ts'
import {
  openPolicy,
  scopeKey,
  target,
  type Context,
  type Grant,
  type Policy,
} from './policy.ts'
import { canonical, hash } from './identity.ts'

export type Registration = Readonly<{ scope: Scope; web: string; pack: string }>
export type Resolved = Context & { registration: Registration; scope: Scope }
export type Execution = Resolved & {
  session: string
  operationId?: string
  inputRevisions: Readonly<Record<string, string>>
  authorize: () => Promise<void>
  can: (grant: Grant) => Promise<boolean>
  committed: (name: string, revisions?: Record<string, string>) => void
  observe: (job: NonNullable<Operation['job']> | undefined) => void
  invalidate: (topic: Topic, grants: Grant[], payload?: unknown) => void
  publishInputs: <T>(work: () => Promise<T>) => Promise<T>
}
export type Definition<I = unknown, O = unknown> = {
  name: string
  effect: Effect
  input: z.ZodType<I>
  output: z.ZodType<O>
  label: string
  href: string
  success: string
  targets: (context: Resolved, input: I) => Promise<Grant[]> | Grant[]
  resultTargets?: (context: Resolved, output: O) => Promise<Grant[]> | Grant[]
  inputs?: (context: Resolved, input: I) => Promise<Record<string, string>>
  available?: (context: Resolved, input: I) => Promise<void> | void
  execute: (context: Execution, input: I) => Promise<O>
}
export function defineOperation<I, O>(definition: Definition<I, O>) {
  return definition
}
export type Event = {
  scope: Scope
  topic: Topic
  payload: unknown
  grants: Grant[]
}
type Outcome = {
  operation: Operation
  payload?: unknown
  error?: ReturnType<typeof failure>
}
export type Delivery = {
  payload: unknown
  authorize: (context: Context) => Promise<void>
}
type Admission = {
  operation: Operation
  outcome: Promise<Outcome>
  authorize: (context: Context) => Promise<void>
}
type InitialAdmission = Omit<Admission, 'authorize'>
type Receipt = {
  hash: string
  command: Command
  grants: Grant[]
  decision: Promise<InitialAdmission>
  record?: Operation
  completedAt?: number
}

/** One service owns admission and outcomes; adapters supply no domain authority. */
export function createWorkspaceService(options: {
  registrations: Registration[]
  definitions: Definition<any, any>[]
  policy?: Policy
  now?: () => number
  shutdown?: () => Promise<void>
  guard?: (context: Resolved) => void | Promise<void>
}) {
  const session = randomUUID()
  const now = options.now ?? Date.now
  const policy = options.policy ?? openPolicy
  const registrations = new Map(
    options.registrations.map((item) => {
      const scope = scopeSchema.parse(item.scope)
      return [scopeKey(scope), Object.freeze({ ...item, scope })]
    }),
  )
  const definitions = new Map(
    options.definitions.map((definition) => [definition.name, definition]),
  )
  if (
    registrations.size !== options.registrations.length ||
    definitions.size !== options.definitions.length
  )
    throw new Error('Duplicate workspace or operation registration')
  for (const definition of [
    defineOperation({
      name: 'activity.read',
      effect: 'query',
      input: z.strictObject({}),
      output: activitySnapshotSchema,
      label: 'Read activity',
      href: '/',
      success: '',
      targets: (ctx) => [
        {
          action: 'operation.read',
          target: target(ctx.scope, 'pack', ctx.scope.packId),
        },
      ],
      execute: (ctx) => activity(ctx, ctx.scope),
      resultTargets: (_ctx, value) =>
        [value.current, ...value.history].flatMap((item) => {
          if (!item) return []
          const record = operations.get(item.id)
          if (!record)
            throw new WorkspaceError(
              'OUTCOME_UNKNOWN',
              'Activity changed; read its current snapshot.',
              'after-refresh',
            )
          return operationGrants(record.operation, record.grants)
        }),
    }),
    defineOperation({
      name: 'operation.read',
      effect: 'query',
      input: z.strictObject({ id: z.uuid() }),
      output: operationSchema,
      label: 'Read operation',
      href: '/',
      success: '',
      targets: (ctx, input) => [
        {
          action: 'operation.read',
          target: target(ctx.scope, 'operation', input.id),
        },
      ],
      execute: (ctx, input) => operationRead(ctx, ctx.scope, input.id),
      resultTargets: (_ctx, value) => {
        const record = operations.get(value.id)
        if (!record)
          throw new WorkspaceError(
            'OUTCOME_UNKNOWN',
            'Operation is no longer retained.',
            'inspect-outcome',
          )
        return operationGrants(record.operation, record.grants)
      },
    }),
    defineOperation({
      name: 'command.outcome',
      effect: 'query',
      input: z.strictObject({ session: z.uuid(), commandId: z.uuid() }),
      output: operationSchema,
      label: 'Read command outcome',
      href: '/',
      success: '',
      targets: (ctx) => [
        {
          action: 'operation.read',
          target: target(ctx.scope, 'pack', ctx.scope.packId),
        },
      ],
      execute: (ctx, input) =>
        commandOutcome(ctx, ctx.scope, input.session, input.commandId),
      resultTargets: (ctx, value) => {
        const receipt = receipts.get(
          scopeKey(ctx.scope) + '/' + value.commandId,
        )
        if (!receipt)
          throw new WorkspaceError(
            'OUTCOME_UNKNOWN',
            'Command is no longer retained.',
            'inspect-outcome',
          )
        return operationGrants(value, receipt.grants)
      },
    }),
  ] as Definition<any, any>[]) {
    if (definitions.has(definition.name))
      throw new Error('Duplicate system operation')
    definitions.set(definition.name, definition)
  }
  const receipts = new Map<string, Receipt>()
  const operations = new Map<
    string,
    { operation: Operation; grants: Grant[] }
  >()
  const leases = new Set<string>()
  const inputPublications = new Map<
    string,
    { active: boolean; revision: number }
  >()
  function publication(scope: Scope) {
    const key = scopeKey(scope)
    if (!inputPublications.has(key))
      inputPublications.set(key, { active: false, revision: 0 })
    return inputPublications.get(key)!
  }
  function readTicket(scope: Scope) {
    const state = publication(scope)
    if (state.active)
      throw new WorkspaceError(
        'BUSY',
        'Generated inputs are being published; retry shortly.',
        'after-idle',
      )
    return state.revision
  }
  const listeners = new Set<(event: Event) => void>()
  let closed = false
  const inputSummaries = new WeakMap<
    Operation,
    { inputsRevision: string; inputCount: number }
  >()
  function activityOperation(operation: Operation) {
    let inputs = inputSummaries.get(operation)
    if (!inputs) {
      inputs = {
        inputsRevision: hash(canonical(operation.inputs)),
        inputCount: Object.keys(operation.inputs).length,
      }
      inputSummaries.set(operation, inputs)
    }
    const {
      result: _result,
      error: _error,
      inputs: _inputs,
      stages: _stages,
      job,
      ...core
    } = operation
    const summary = activityOperationSchema.parse({
      ...core,
      ...inputs,
      message: boundedText(operation.message, 2048),
      stages: operation.stages
        .slice(-32)
        .map(({ name, committed }) => ({ name, committed })),
      stageCount: operation.stages.length,
      stagesTruncated: operation.stages.length > 32,
      ...(job
        ? {
            job: {
              ...job,
              diagnostic: job.diagnostic
                ? boundedText(job.diagnostic, 2048)
                : undefined,
              diagnosticTruncated:
                !!job.diagnostic &&
                new TextEncoder().encode(job.diagnostic).length > 2048,
            },
          }
        : {}),
    })
    const size = () => Buffer.byteLength(JSON.stringify(summary))
    if (size() > 8192 && summary.job?.diagnostic) {
      summary.job.diagnostic = undefined
      summary.job.diagnosticTruncated = true
    }
    while (size() > 8192 && summary.stages.length) {
      summary.stages.shift()
      summary.stagesTruncated = true
    }
    while (size() > 8192 && summary.message.length)
      summary.message = boundedText(
        summary.message,
        Math.floor(new TextEncoder().encode(summary.message).length / 2),
      )
    return summary
  }

  function resolve(context: Context, scope: Scope): Resolved {
    const registration = registrations.get(scopeKey(scopeSchema.parse(scope)))
    if (!registration)
      throw new WorkspaceError('NOT_FOUND', 'Workspace is unavailable')
    return { ...context, registration, scope: registration.scope }
  }
  async function can(context: Context, grant: Grant) {
    if (!registrations.has(scopeKey(grant.target))) return false
    return (await policy.decide(context, grant.action, grant.target)).allowed
  }
  async function authorize(context: Context, grants: Grant[]) {
    for (const grant of grants)
      if (!(await can(context, grant)))
        throw new WorkspaceError('NOT_FOUND', 'This resource is unavailable')
  }
  const packGrant = (scope: Scope): Grant => ({
    action: 'pack.read',
    target: target(scope, 'pack', scope.packId),
  })
  function emit(event: Event) {
    for (const listener of listeners) {
      // A transport observer must not change an authoritative effect's outcome.
      try {
        listener(event)
      } catch {
        /* The adapter owns disconnect/resync. */
      }
    }
  }
  const operationGrants = (
    operation: Operation,
    observed: Grant[],
  ): Grant[] => [
    packGrant(operation.scope),
    {
      action: 'operation.read',
      target: target(operation.scope, 'operation', operation.id),
    },
    ...observed.map(({ target: resource }): Grant => ({
      target: resource,
      action:
        resource.kind === 'source'
          ? 'source.read'
          : resource.kind === 'environment'
            ? 'environment.read'
            : resource.kind === 'artifact' || resource.kind === 'projection'
              ? 'artifact.read'
              : resource.kind === 'operation'
                ? 'operation.read'
                : 'pack.read',
    })),
  ]
  function trim() {
    for (const [id, receipt] of receipts)
      if (
        receipt.completedAt !== undefined &&
        now() - receipt.completedAt >= limits.receiptAge
      )
        receipts.delete(id)
    for (const registration of registrations.values()) {
      const terminal = [...operations.entries()].filter(
        ([, value]) =>
          scopeKey(value.operation.scope) === scopeKey(registration.scope) &&
          value.operation.state !== 'running' &&
          value.operation.effect !== 'control',
      )
      for (const [id] of terminal.slice(0, -limits.history))
        operations.delete(id)
    }
    for (const [id, { operation }] of operations)
      if (
        operation.effect === 'control' &&
        operation.state !== 'running' &&
        !receipts.has(scopeKey(operation.scope) + '/' + operation.commandId)
      )
        operations.delete(id)
  }
  function definition(name: string, effect?: 'query') {
    const found = definitions.get(name)
    if (!found || (effect === 'query' && found.effect !== 'query'))
      throw new WorkspaceError('NOT_FOUND', 'Unknown workspace operation')
    return found
  }
  function inputFor(def: Definition<any, any>, value: unknown) {
    try {
      assertJson(value)
      return def.input.parse(value)
    } catch {
      invalid()
    }
  }
  async function grantsFor(
    ctx: Resolved,
    def: Definition<any, any>,
    input: unknown,
  ) {
    await authorize(ctx, [packGrant(ctx.scope)])
    if (
      def.effect !== 'control' &&
      !['activity.read', 'operation.read', 'command.outcome'].includes(def.name)
    )
      readTicket(ctx.scope)
    const grants = [packGrant(ctx.scope), ...(await def.targets(ctx, input))]
    if (grants.some((g) => scopeKey(g.target) !== scopeKey(ctx.scope)))
      throw new Error('Operation target escaped its registered scope')
    await authorize(ctx, grants)
    if (def.effect !== 'query' && def.effect !== 'control')
      await options.guard?.(ctx)
    return grants
  }
  function execution(
    ctx: Resolved,
    grants: Grant[],
    operation?: Operation,
  ): Execution {
    return {
      ...ctx,
      session,
      operationId: operation?.id,
      inputRevisions: operation?.inputs ?? {},
      authorize: async () => {
        if (closed)
          throw new WorkspaceError(
            'STORAGE_UNAVAILABLE',
            'Workspace is stopping',
            'reconnect',
          )
        await authorize(ctx, grants)
        if (operation && operation.effect !== 'control')
          await options.guard?.(ctx)
      },
      can: (grant) => can(ctx, grant),
      async publishInputs(work) {
        if (!operation || operation.effect === 'control')
          throw new Error(
            'Only authoring operations can publish generated inputs',
          )
        await authorize(ctx, grants)
        const state = publication(ctx.scope)
        if (state.active)
          throw new WorkspaceError(
            'BUSY',
            'Generated inputs are being published.',
            'after-idle',
          )
        state.active = true
        state.revision++
        try {
          return await work()
        } finally {
          state.revision++
          state.active = false
        }
      },
      committed(name, revisions) {
        if (!operation) throw new Error('Queries cannot commit effects')
        operation.stages.push({
          name,
          committed: true,
          ...(revisions ? { revisions } : {}),
        })
      },
      observe(job) {
        if (!operation) throw new Error('Queries cannot start jobs')
        operation.job = job
        if (operation.effect !== 'control')
          emit({
            scope: ctx.scope,
            topic: 'activity',
            grants: operationGrants(operation, grants),
            payload: { operation: activityOperation(operation) },
          })
      },
      invalidate(topic, required, payload = { kind: 'invalidated' }) {
        if (!operation) throw new Error('Queries cannot publish invalidations')
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const value = payload as Record<string, unknown>
          const saved = Object.assign(
            {},
            ...operation.stages.map((stage) => stage.revisions ?? {}),
          )
          payload = {
            ...value,
            operationId: operation.id,
            commandId: operation.commandId,
            ...(topic === 'sources' && Array.isArray(value.sources)
              ? {
                  revisions: Object.fromEntries(
                    value.sources
                      .filter((id): id is string => typeof id === 'string')
                      .map((id) => [id, saved[id] ?? null]),
                  ),
                }
              : {}),
          }
        }
        emit({
          scope: ctx.scope,
          topic,
          grants: [packGrant(ctx.scope), ...required],
          payload,
        })
      },
    }
  }
  function publicAdmission(
    ctx: Context,
    receipt: Receipt,
    admission: InitialAdmission,
  ): Admission {
    const outcome = admission.outcome.then(async (outcome) => {
      await authorize(ctx, operationGrants(outcome.operation, receipt.grants))
      return structuredClone(outcome)
    })
    void outcome.catch(() => {})
    return {
      operation: structuredClone(admission.operation),
      outcome,
      authorize: async (context) => {
        if (closed)
          throw new WorkspaceError(
            'STORAGE_UNAVAILABLE',
            'Workspace stopped',
            'reconnect',
          )
        resolve(context, admission.operation.scope)
        await authorize(
          context,
          operationGrants(receipt.record!, receipt.grants),
        )
      },
    }
  }
  async function queryDelivery(
    context: Context,
    scope: Scope,
    name: string,
    value: unknown,
  ) {
    if (closed)
      throw new WorkspaceError(
        'STORAGE_UNAVAILABLE',
        'Workspace is stopping',
        'reconnect',
      )
    const ctx = resolve(context, scope)
    const def = definition(name, 'query')
    const independent = [
      'activity.read',
      'operation.read',
      'command.outcome',
    ].includes(name)
    const input = inputFor(def, value)
    const grants = await grantsFor(ctx, def, input)
    const ticket = independent ? null : readTicket(scope)
    // A consistent query is independent of mutation/native admission.
    const result = def.output.parse(
      await def.execute(execution(ctx, grants), input),
    )
    const resultGrants = (await def.resultTargets?.(ctx, result)) ?? []
    if (
      resultGrants.some(
        (grant) => scopeKey(grant.target) !== scopeKey(ctx.scope),
      )
    )
      throw new Error('Result target escaped its registered scope')
    await authorize(ctx, [...grants, ...resultGrants])
    if (ticket !== null && readTicket(scope) !== ticket)
      throw new WorkspaceError(
        'BUSY',
        'Generated inputs changed during the read; retry shortly.',
        'after-idle',
      )
    const required = structuredClone([...grants, ...resultGrants])
    return {
      payload: result,
      authorize: async (actor: Context) => {
        if (closed)
          throw new WorkspaceError(
            'STORAGE_UNAVAILABLE',
            'Workspace stopped',
            'reconnect',
          )
        resolve(actor, scope)
        await authorize(actor, required)
      },
    }
  }
  async function query(
    context: Context,
    scope: Scope,
    name: string,
    value: unknown,
  ) {
    return (await queryDelivery(context, scope, name, value)).payload
  }
  function submit(context: Context, raw: unknown): Promise<Admission> {
    if (closed)
      return Promise.reject(
        new WorkspaceError(
          'STORAGE_UNAVAILABLE',
          'Workspace is stopping',
          'reconnect',
        ),
      )
    let command: Command
    try {
      assertJson(raw, limits.incoming)
      command = commandSchema.parse(structuredClone(raw))
    } catch {
      return Promise.reject(
        new WorkspaceError('INVALID_INPUT', 'Invalid command envelope'),
      )
    }
    if (command.session !== session)
      return Promise.reject(
        new WorkspaceError(
          'SESSION_CHANGED',
          'The workspace restarted; review the saved source before submitting again.',
          'inspect-outcome',
        ),
      )
    let ctx: Resolved, def: Definition<any, any>, input: unknown
    try {
      ctx = resolve(context, command.scope)
      def = definition(command.operation)
      if (def.effect === 'query') invalid('Use a query for this operation')
      input = inputFor(def, command.payload)
    } catch (error) {
      return Promise.reject(error)
    }
    const { requestId: _request, ...identity } = command
    const commandHash = hash(canonical(identity))
    const key = scopeKey(command.scope) + '/' + command.commandId
    trim()
    const existing = receipts.get(key)
    if (existing)
      return (async () => {
        await grantsFor(ctx, def, input)
        const admitted = await existing.decision
        await authorize(ctx, existing.grants)
        if (existing.hash !== commandHash)
          throw new WorkspaceError(
            'COMMAND_ID_CONFLICT',
            'This command ID already has different input.',
            'never',
          )
        return publicAdmission(ctx, existing, admitted)
      })()
    if (Math.abs(now() - Date.parse(command.createdAt)) > limits.commandAge)
      return Promise.reject(
        new WorkspaceError(
          'OUTCOME_UNKNOWN',
          'This command is too old or the clock differs; review its outcome before resubmitting.',
          'inspect-outcome',
        ),
      )
    if (receipts.size >= limits.receipts)
      return Promise.reject(
        new WorkspaceError(
          'CAPACITY_REACHED',
          'Recent command capacity is full; retry later.',
          'after-idle',
        ),
      )

    // Reserve before any await: identical concurrent attempts share the guarded decision.
    let accept!: (value: InitialAdmission) => void,
      reject!: (error: unknown) => void
    const receipt: Receipt = {
      hash: commandHash,
      command,
      grants: [],
      decision: new Promise((resolve, fail) => {
        accept = resolve
        reject = fail
      }),
    }
    receipts.set(key, receipt)
    void (async () => {
      let leased = false
      const owner = scopeKey(ctx.scope)
      try {
        receipt.grants = await grantsFor(ctx, def, input)
        await def.available?.(ctx, input)
        await authorize(ctx, receipt.grants)
        if (closed)
          throw new WorkspaceError(
            'STORAGE_UNAVAILABLE',
            'Workspace is stopping',
            'reconnect',
          )
        if (def.effect !== 'control') {
          if (leases.has(owner))
            throw new WorkspaceError(
              'BUSY',
              'Another authoring operation is running.',
              'after-idle',
            )
          leases.add(owner)
          leased = true
        }
        const inputs = (await def.inputs?.(ctx, input)) ?? {}
        await authorize(ctx, receipt.grants)
        const operation = operationSchema.parse({
          id: randomUUID(),
          commandId: command.commandId,
          scope: ctx.scope,
          name: def.name,
          effect: def.effect,
          label: def.label,
          href: def.href,
          state: 'running',
          message: '',
          startedAt: new Date(now()).toISOString(),
          inputs,
          stages: [],
        })
        receipt.record = operation
        Object.freeze(operation.inputs)
        operations.set(operation.id, { operation, grants: receipt.grants })
        // Admission is an immutable initial record, never a race-dependent copy
        // of a completed result the reader may not be allowed to receive.
        const admittedOperation = structuredClone(operation)
        const outcome = (async (): Promise<Outcome> => {
          try {
            await authorize(ctx, receipt.grants)
            const payload = def.output.parse(
              await def.execute(
                execution(ctx, receipt.grants, operation),
                input,
              ),
            )
            const resultGrants = (await def.resultTargets?.(ctx, payload)) ?? []
            if (
              resultGrants.some(
                (grant) => scopeKey(grant.target) !== scopeKey(ctx.scope),
              )
            )
              throw new Error('Result target escaped its registered scope')
            receipt.grants.push(...resultGrants)
            operation.state = 'succeeded'
            operation.message = boundedText(def.success, 4096)
            operation.result = payload
            return { operation, payload }
          } catch (error) {
            operation.error = failure(error)
            operation.state =
              operation.error.code === 'OUTCOME_UNKNOWN'
                ? 'unknown'
                : operation.error.code === 'CANCELLED'
                  ? 'cancelled'
                  : 'failed'
            operation.message = operation.error.message
            return { operation, error: operation.error }
          } finally {
            operation.finishedAt = new Date(now()).toISOString()
            receipt.completedAt = now()
            if (leased) leases.delete(owner)
            trim()
            if (def.effect !== 'control')
              emit({
                scope: ctx.scope,
                topic: 'activity',
                grants: operationGrants(operation, receipt.grants),
                payload: { operation: activityOperation(operation) },
              })
          }
        })()
        accept({ operation: admittedOperation, outcome })
        if (def.effect !== 'control')
          emit({
            scope: ctx.scope,
            topic: 'activity',
            grants: operationGrants(operation, receipt.grants),
            payload: { operation: activityOperation(operation) },
          })
      } catch (error) {
        if (leased) leases.delete(owner)
        receipts.delete(key)
        reject(error)
      }
    })()
    return receipt.decision.then((admitted) =>
      publicAdmission(ctx, receipt, admitted),
    )
  }
  async function activity(context: Context, scope: Scope) {
    resolve(context, scope)
    await authorize(context, [
      packGrant(scope),
      { action: 'operation.read', target: target(scope, 'pack', scope.packId) },
    ])
    const visible = []
    for (const { operation, grants } of operations.values())
      if (
        scopeKey(operation.scope) === scopeKey(scope) &&
        operation.effect !== 'control' &&
        (
          await Promise.all(
            operationGrants(operation, grants).map((grant) =>
              can(context, grant),
            ),
          )
        ).every(Boolean)
      )
        visible.push(activityOperation(operation))
    return {
      session,
      current: visible.find((o) => o.state === 'running') ?? null,
      history: visible
        .filter((o) => o.state !== 'running')
        .reverse()
        .slice(0, limits.history),
    }
  }
  async function commandOutcome(
    context: Context,
    scope: Scope,
    priorSession: string,
    commandId: string,
  ) {
    resolve(context, scope)
    await authorize(context, [
      packGrant(scope),
      { action: 'operation.read', target: target(scope, 'pack', scope.packId) },
    ])
    if (priorSession !== session)
      throw new WorkspaceError(
        'SESSION_CHANGED',
        'The previous service outcome is unavailable.',
        'inspect-outcome',
      )
    trim()
    const receipt = receipts.get(scopeKey(scope) + '/' + commandId)
    if (!receipt)
      throw new WorkspaceError(
        'OUTCOME_UNKNOWN',
        'The command outcome is not retained; inspect saved state.',
        'inspect-outcome',
      )
    const admitted = await receipt.decision
    await authorize(
      context,
      operationGrants(admitted.operation, receipt.grants),
    )
    return structuredClone(receipt.record!)
  }
  async function operationRead(context: Context, scope: Scope, id: string) {
    resolve(context, scope)
    await authorize(context, [
      packGrant(scope),
      { action: 'operation.read', target: target(scope, 'operation', id) },
    ])
    const record = operations.get(id)
    if (!record || scopeKey(record.operation.scope) !== scopeKey(scope))
      throw new WorkspaceError('NOT_FOUND', 'Operation is unavailable')
    await authorize(context, operationGrants(record.operation, record.grants))
    return structuredClone(record.operation)
  }
  return {
    session,
    policy,
    query,
    queryDelivery,
    submit,
    activity,
    commandOutcome,
    resolve,
    can,
    definitions: () =>
      [...definitions.values()].map(({ name, effect, label, href }) => ({
        name,
        effect,
        label,
        href,
      })),
    operationRunning(scope: Scope, id: string) {
      const current = operations.get(id)?.operation
      return (
        current?.state === 'running' &&
        scopeKey(current.scope) === scopeKey(scope)
      )
    },
    onEvent(listener: (event: Event) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async eventFor(context: Context, event: Event) {
      for (const grant of event.grants)
        if (!(await can(context, grant))) return null
      return { scope: event.scope, topic: event.topic, payload: event.payload }
    },
    invalidate(event: Event) {
      emit(event)
    },
    publicationState(scope: Scope) {
      return { ...publication(scope) }
    },
    async dispose() {
      closed = true
      await options.shutdown?.()
      await Promise.allSettled(
        [...receipts.values()].map(
          async (receipt) => (await receipt.decision).outcome,
        ),
      )
      listeners.clear()
    },
  }
}
