import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { createSourceRepository } from '../scripts/workspace/files.ts'
import { mapDefinitions } from '../scripts/workspace/map.ts'
import {
  target,
  admitDelivery,
  openPolicy,
} from '../scripts/workspace/policy.ts'
import { canonical, hash } from '../scripts/workspace/identity.ts'
import {
  parseClientFrame,
  serverFrameSchema,
  assertJson,
} from '../src/lib/workspace/contracts.ts'
import { domains } from '../src/lib/domains.mjs'

const actor = {
  principal: { kind: 'anonymous', id: 'local-open' },
  connectionId: randomUUID(),
}
const gate = () => Promise.withResolvers()
async function fixture(t, id = 'create_sky') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-service-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const web = path.join(root, 'web'),
    pack = path.join(root, 'pack')
  await fs.mkdir(path.join(web, 'data/authored'), { recursive: true })
  await fs.mkdir(pack)
  for (const name of domains)
    await fs.writeFile(
      path.join(web, 'data/authored', name + '.yml'),
      name === 'recipes' ? 'schema: 1\nchanges: []\n' : 'schema: 1\n',
    )
  return { scope: { workspaceId: 'local', packId: id }, web, pack }
}
function command(service, scope, operation, payload, extra = {}) {
  return {
    v: 1,
    type: 'command',
    requestId: randomUUID(),
    commandId: randomUUID(),
    session: service.session,
    createdAt: new Date().toISOString(),
    scope,
    operation,
    payload,
    ...extra,
  }
}
const code = (expected) => (error) => error.code === expected

test('real map sources read/save exact bytes, validate drafts and preserve revision conflicts', async (t) => {
  const registration = await fixture(t)
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: mapDefinitions([registration]),
  })
  t.after(() => service.dispose())
  const source = await service.query(
    actor,
    registration.scope,
    'map.sources.read',
    {},
  )
  assert.equal(Object.keys(source.files).length, 8)
  const text = 'schema: 1\nchanges: []\n# written source\n'
  const frame = command(service, registration.scope, 'map.source.save', {
    name: 'recipes',
    text,
    revision: source.files.recipes.revision,
  })
  const admitted = await service.submit(actor, frame),
    outcome = await admitted.outcome
  assert.equal(outcome.operation.state, 'succeeded')
  assert.equal(outcome.payload.revision, hash(text))
  assert.equal(outcome.payload.sourceSaved, true)
  assert.equal(
    await fs.readFile(
      path.join(registration.web, 'data/authored/recipes.yml'),
      'utf8',
    ),
    text,
  )
  assert.equal(outcome.operation.stages[0].committed, true)
  assert.equal(
    (
      await service.commandOutcome(
        actor,
        registration.scope,
        service.session,
        frame.commandId,
      )
    ).state,
    'succeeded',
  )
  const stale = await service.submit(
    actor,
    command(service, registration.scope, 'map.source.save', {
      name: 'recipes',
      text: 'schema: 1\nchanges: []',
      revision: source.files.recipes.revision,
    }),
  )
  assert.equal((await stale.outcome).error.code, 'REVISION_CONFLICT')
  const invalid = await service.submit(
    actor,
    command(service, registration.scope, 'map.source.save', {
      name: 'recipes',
      text: 'schema: 1\nchanges: [{id: "bad:../escape"}]',
      revision: hash(text),
    }),
  )
  assert.equal((await invalid.outcome).error.code, 'INVALID_INPUT')
  await assert.rejects(
    service.submit(actor, {
      ...frame,
      commandId: randomUUID(),
      payload: { ...frame.payload, program: 'sh' },
    }),
    code('INVALID_INPUT'),
  )
})

test('restrictive queries filter before counts; effects, receipts and outgoing events recheck current authority', async (t) => {
  const one = await fixture(t, 'alpha'),
    two = await fixture(t, 'beta')
  let deny = false,
    executed = 0
  const events = []
  const policy = {
    mode: 'restricted',
    decide(_ctx, action, resource) {
      return {
        allowed:
          resource.packId === 'alpha' &&
          (!deny || action !== 'source.read') &&
          !(action === 'source.read' && resource.id === 'map:items'),
      }
    },
  }
  const definitions = mapDefinitions([one, two])
  const original = definitions[1].execute
  definitions[1].execute = async (...args) => {
    executed++
    return original(...args)
  }
  const service = createWorkspaceService({
    registrations: [one, two],
    definitions,
    policy,
  })
  t.after(() => service.dispose())
  service.onEvent((e) => events.push(e))
  const sources = await service.query(actor, one.scope, 'map.sources.read', {})
  assert.equal(Object.keys(sources.files).length, 7)
  assert.equal(sources.files.items, undefined)
  await assert.rejects(
    service.query(actor, two.scope, 'map.sources.read', {}),
    code('NOT_FOUND'),
  )
  await assert.rejects(
    service.query(
      actor,
      { workspaceId: 'local', packId: 'forged' },
      'map.sources.read',
      {},
    ),
    code('NOT_FOUND'),
  )
  const payload = {
    name: 'recipes',
    text: 'schema: 1\nchanges: []\n# alpha\n',
    revision: sources.files.recipes.revision,
  }
  const frame = command(service, one.scope, 'map.source.save', payload)
  const admitted = await service.submit(actor, frame)
  await admitted.outcome
  assert.equal(executed, 1)
  assert.ok(events.length)
  deny = true
  assert.equal(await service.eventFor(actor, events.at(-1)), null)
  assert.equal((await service.activity(actor, one.scope)).history.length, 0)
  await assert.rejects(
    service.commandOutcome(actor, one.scope, service.session, frame.commandId),
    code('NOT_FOUND'),
  )
  await assert.rejects(
    service.submit(actor, { ...frame, requestId: randomUUID() }),
    code('NOT_FOUND'),
  )
  await assert.rejects(
    service.submit(
      actor,
      command(service, two.scope, 'map.source.save', payload),
    ),
    code('NOT_FOUND'),
  )
  assert.equal(executed, 1)
  assert.equal(
    await fs.readFile(path.join(two.web, 'data/authored/recipes.yml'), 'utf8'),
    'schema: 1\nchanges: []\n',
  )
})

test('concurrent duplicate commands execute once; reads stay available and other mutations get BUSY', async (t) => {
  const registration = await fixture(t),
    pending = gate()
  let calls = 0
  const preview = defineOperation({
    name: 'journal.preview',
    effect: 'preview',
    input: z.strictObject({ value: z.number() }),
    output: z.strictObject({ value: z.number() }),
    label: 'Preview journal',
    href: '/authoring',
    success: 'Preview ready.',
    targets: (ctx) => [
      {
        action: 'preview.run',
        target: target(ctx.scope, 'pack', ctx.scope.packId),
      },
    ],
    async execute(_ctx, input) {
      calls++
      await pending.promise
      return input
    },
  })
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: [...mapDefinitions([registration]), preview],
  })
  t.after(() => service.dispose())
  const frame = command(service, registration.scope, 'journal.preview', {
    value: 1,
  })
  const [first, second] = await Promise.all([
    service.submit(actor, frame),
    service.submit(actor, { ...frame, requestId: randomUUID() }),
  ])
  assert.equal(first.operation.id, second.operation.id)
  assert.equal(calls, 1)
  assert.equal(
    Object.keys(
      (await service.query(actor, registration.scope, 'map.sources.read', {}))
        .files,
    ).length,
    8,
  )
  await assert.rejects(
    service.submit(
      actor,
      command(service, registration.scope, 'journal.preview', { value: 2 }),
    ),
    code('BUSY'),
  )
  await assert.rejects(
    service.submit(actor, {
      ...frame,
      requestId: randomUUID(),
      payload: { value: 3 },
    }),
    code('COMMAND_ID_CONFLICT'),
  )
  pending.resolve()
  assert.equal((await first.outcome).payload.value, 1)
  assert.equal((await second.outcome).payload.value, 1)
  const retry = await service.submit(actor, {
    ...frame,
    requestId: randomUUID(),
  })
  assert.equal((await retry.outcome).operation.state, 'succeeded')
  assert.equal(calls, 1)
})

test('authority revoked during validation prevents commit; stale sessions and expired commands do not execute', async (t) => {
  const registration = await fixture(t),
    pending = gate()
  let allowed = true,
    writes = 0,
    time = Date.now()
  const preview = defineOperation({
    name: 'journal.preview',
    effect: 'preview',
    input: z.strictObject({}),
    output: z.strictObject({}),
    label: 'Preview',
    href: '/authoring',
    success: 'Ready.',
    targets: (ctx) => [
      {
        action: 'preview.run',
        target: target(ctx.scope, 'pack', ctx.scope.packId),
      },
    ],
    async execute(ctx) {
      await pending.promise
      await ctx.authorize()
      writes++
      return {}
    },
  })
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: [preview],
    now: () => time,
    policy: { mode: 'restricted', decide: () => ({ allowed }) },
  })
  t.after(() => service.dispose())
  const frame = command(service, registration.scope, 'journal.preview', {})
  const admitted = await service.submit(actor, frame)
  const outcome = admitted.outcome.catch((error) => error)
  allowed = false
  pending.resolve()
  assert.equal((await outcome).code, 'NOT_FOUND')
  assert.equal(writes, 0)
  allowed = true
  await assert.rejects(
    service.submit(actor, {
      ...frame,
      commandId: randomUUID(),
      session: randomUUID(),
    }),
    code('SESSION_CHANGED'),
  )
  await assert.rejects(
    service.submit(actor, {
      ...frame,
      commandId: randomUUID(),
      createdAt: new Date(time - 31_000).toISOString(),
    }),
    code('OUTCOME_UNKNOWN'),
  )
  time += 31 * 60_000
  await assert.rejects(
    service.commandOutcome(
      actor,
      registration.scope,
      service.session,
      frame.commandId,
    ),
    code('OUTCOME_UNKNOWN'),
  )
  assert.equal(writes, 0)
})

test('source paths reject traversal/symlinks and partial rollback never overwrites an external edit', async (t) => {
  const registration = await fixture(t),
    sources = createSourceRepository(registration)
  await assert.rejects(sources.read('../../secret'), code('NOT_FOUND'))
  const secret = path.join(registration.pack, 'private.txt')
  await fs.writeFile(secret, 'private')
  const file = path.join(registration.web, 'data/authored/recipes.yml')
  await fs.unlink(file)
  await fs.symlink(secret, file)
  await assert.rejects(sources.read('map:recipes'), code('INVALID_INPUT'))
  await fs.unlink(file)
  await fs.writeFile(file, 'schema: 1\nchanges: []\n')
  const before = await sources.snapshot(['map:items', 'map:recipes'])
  let interrupted = false
  const items = path.join(registration.web, 'data/authored/items.yml')
  await assert.rejects(
    sources.commit(
      {
        'map:items': 'schema: 1\n# saved\n',
        'map:recipes': 'schema: 1\nchanges: []\n# saved\n',
      },
      before,
      {
        publishInputs: (work) => work(),
        async authorize() {
          if (
            !interrupted &&
            (await fs.readFile(items, 'utf8')) === 'schema: 1\n# saved\n'
          ) {
            interrupted = true
            await fs.writeFile(items, 'external editor bytes\n')
            throw new Error('interrupted second write')
          }
        },
        committed() {},
      },
    ),
    code('SOURCE_PARTIAL'),
  )
  assert.equal(interrupted, true)
  assert.equal(await fs.readFile(items, 'utf8'), 'external editor bytes\n')
  assert.equal(await fs.readFile(file, 'utf8'), 'schema: 1\nchanges: []\n')
  const transactions = path.join(
    registration.web,
    '.cache/workspace/local/create_sky/transactions',
  )
  assert.equal((await fs.readdir(transactions)).length, 1)
})

test('protocol rejects unknown actor/execution fields, deep JSON and non-finite identity inputs', () => {
  const scope = { workspaceId: 'local', packId: 'create_sky' }
  const hello = { v: 1, type: 'hello', requestId: randomUUID(), scope }
  assert.equal(parseClientFrame(JSON.stringify(hello)).type, 'hello')
  assert.throws(() =>
    parseClientFrame(JSON.stringify({ ...hello, principal: { id: 'admin' } })),
  )
  assert.throws(() =>
    parseClientFrame(
      JSON.stringify({ ...hello, scope: { ...scope, root: '/tmp' } }),
    ),
  )
  let nested = {}
  for (let i = 0; i < 65; i++) nested = { nested }
  assert.throws(() => assertJson(nested))
  assert.throws(() => canonical({ weight: Infinity }))
  const shared = { id: 1 }
  assert.equal(canonical([shared, shared]), '[{"id":1},{"id":1}]')
  assert.throws(() =>
    admitDelivery('open-local', {
      mode: 'restricted',
      decide: () => ({ allowed: true }),
    }),
  )
  admitDelivery('open-static', openPolicy)
  assert.equal(
    serverFrameSchema.safeParse({
      v: 1,
      type: 'error',
      error: { code: 'BUSY', message: 'Busy', recovery: 'after-idle' },
    }).success,
    true,
  )
})

test('result-read permissions cover fast admission, receipts, queries and terminal events', async (t) => {
  const registration = await fixture(t),
    events = []
  let effects = 0
  const resource = target(registration.scope, 'artifact', 'secret-result')
  const definition = (name, effect) =>
    defineOperation({
      name,
      effect,
      input: z.strictObject({}),
      output: z.unknown(),
      label: 'Fixture',
      href: '/',
      success: 'Complete',
      targets: () => [],
      resultTargets: () => [{ action: 'artifact.read', target: resource }],
      async execute() {
        if (effect !== 'query') effects++
        return { secret: 'result contents' }
      },
    })
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: [
      definition('fixture.generate', 'generate'),
      definition('fixture.read', 'query'),
    ],
    policy: {
      mode: 'restricted',
      decide: (_ctx, action, value) => ({
        allowed: action !== 'artifact.read' || value.id !== resource.id,
      }),
    },
  })
  t.after(() => service.dispose())
  service.onEvent((event) => events.push(event))
  const request = command(service, registration.scope, 'fixture.generate', {})
  const admitted = await service.submit(actor, request)
  assert.equal(admitted.operation.result, undefined)
  await assert.rejects(admitted.outcome, code('NOT_FOUND'))
  assert.equal(effects, 1)
  assert.equal(
    (await service.activity(actor, registration.scope)).history.length,
    0,
  )
  assert.equal(await service.eventFor(actor, events.at(-1)), null)
  await assert.rejects(
    service.commandOutcome(
      actor,
      registration.scope,
      service.session,
      request.commandId,
    ),
    code('NOT_FOUND'),
  )
  await assert.rejects(
    service.submit(actor, { ...request, requestId: randomUUID() }),
    code('NOT_FOUND'),
  )
  await assert.rejects(
    service.query(actor, registration.scope, 'fixture.read', {}),
    code('NOT_FOUND'),
  )
  assert.equal(effects, 1)
})

test('activity history stays within control-frame bounds without losing detailed input identity', async (t) => {
  const registration = await fixture(t)
  const inputs = Object.fromEntries(
    Array.from({ length: 500 }, (_, index) => [
      `input:${index}:${'a'.repeat(100)}`,
      hash(String(index)),
    ]),
  )
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: [
      defineOperation({
        name: 'fixture.inspect',
        effect: 'inspect',
        input: z.strictObject({}),
        output: z.unknown(),
        label: 'Large input inspection',
        href: '/',
        success: '完成'.repeat(2000),
        targets: () => [],
        inputs: async () => inputs,
        async execute(ctx) {
          assert.equal(Object.isFrozen(ctx.inputRevisions), true)
          for (let index = 0; index < 30; index++)
            ctx.committed('stage-' + index + '-' + 'x'.repeat(70))
          ctx.observe({
            id: 'fixture',
            name: 'fixture.inspect',
            state: 'succeeded',
            cancellable: false,
            diagnostic: '诊断'.repeat(2000),
          })
          return { complete: true }
        },
      }),
    ],
  })
  t.after(() => service.dispose())
  let operationId
  for (let index = 0; index < 20; index++) {
    const admitted = await service.submit(
      actor,
      command(service, registration.scope, 'fixture.inspect', {}),
    )
    operationId = admitted.operation.id
    await admitted.outcome
  }
  const snapshot = await service.activity(actor, registration.scope)
  assert.equal(snapshot.history.length, 20)
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 256 * 1024)
  assert.equal(snapshot.history[0].inputCount, 500)
  assert.equal(snapshot.history[0].inputsRevision, hash(canonical(inputs)))
  assert.equal(snapshot.history[0].stageCount, 30)
  const detail = await service.query(
    actor,
    registration.scope,
    'operation.read',
    { id: operationId },
  )
  assert.deepEqual(detail.inputs, inputs)
  assert.equal(detail.stages.length, 30)
  assert.ok(Buffer.byteLength(detail.message) <= 4096)
})
