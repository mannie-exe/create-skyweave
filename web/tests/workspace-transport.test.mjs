import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import WebSocket from 'ws'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { attachWorkspaceTransport } from '../scripts/workspace/transport.ts'
import { serverFrameSchema, limits } from '../src/lib/workspace/contracts.ts'
import { target } from '../scripts/workspace/policy.ts'

const scope = { workspaceId: 'local', packId: 'create_skyweave' }
const gate = () => Promise.withResolvers()
const frame = (type, fields = {}) => ({
  v: 1,
  type,
  requestId: randomUUID(),
  scope,
  ...fields,
})
function definition(name, effect, execute) {
  return defineOperation({
    name,
    effect,
    input: z.strictObject({}),
    output: z.unknown(),
    label: 'Fixture',
    href: '/',
    success: 'Complete',
    targets: () => [],
    execute,
  })
}
async function fixture(t, config = {}) {
  const registration = { scope, web: process.cwd(), pack: process.cwd() }
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: config.definitions ?? [],
    policy: config.policy,
  })
  let transport
  const server = createServer(
    (req, res) =>
      void transport
        .http(req, res)
        .then((handled) => {
          if (!handled) res.writeHead(404).end()
        })
        .catch(() => res.writeHead(500).end()),
  )
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  transport = attachWorkspaceTransport({
    server,
    service,
    scope,
    mode: config.mode ?? 'service',
    origins: () => [origin],
    snapshot: config.snapshot
      ? async (ctx, requested, topic) => ({
          payload: await config.snapshot(ctx, requested, topic),
          authorize: async (actor) => {
            await config.snapshot(actor, requested, topic)
          },
        })
      : (ctx, requested) =>
          service.queryDelivery(ctx, requested, 'activity.read', {}),
    heartbeat: config.heartbeat,
  })
  t.after(async () => {
    transport.dispose()
    await service.dispose()
    await new Promise((resolve) => server.close(resolve))
  })
  const clients = new Set()
  t.after(() => {
    for (const client of clients) client.terminate()
  })
  async function connect(options = {}) {
    const socket = new WebSocket(
      origin.replace('http', 'ws') + (options.path ?? '/__atlas/ws'),
      options.protocol ?? 'atlas.v1',
      { origin, ...options },
    )
    clients.add(socket)
    const pending = [],
      buffered = []
    socket.on('message', (data) => {
      const message = serverFrameSchema.parse(JSON.parse(data.toString()))
      const index = pending.findIndex((waiter) => waiter.predicate(message))
      if (index < 0) buffered.push(message)
      else {
        const waiter = pending.splice(index, 1)[0]
        clearTimeout(waiter.timer)
        waiter.resolve(message)
      }
    })
    function wait(predicate) {
      const index = buffered.findIndex(predicate)
      if (index >= 0) return Promise.resolve(buffered.splice(index, 1)[0])
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timer: setTimeout(() => {
            pending.splice(pending.indexOf(waiter), 1)
            reject(new Error('Missing expected socket frame'))
          }, 3000),
        }
        pending.push(waiter)
      })
    }
    const opened = once(socket, 'open')
    socket.on('error', () => {})
    await opened
    return {
      socket,
      wait,
      buffered,
      send: (message) => socket.send(JSON.stringify(message)),
      async request(message, type = 'result') {
        const response = wait(
          (value) =>
            value.requestId === message.requestId &&
            (value.type === type || value.type === 'error'),
        )
        socket.send(JSON.stringify(message))
        return response
      },
      async hello() {
        return this.request(frame('hello'), 'welcome')
      },
    }
  }
  return { server, service, origin, connect }
}

test('same-host bootstrap and socket handshake enforce origin, protocol, hello and strict JSON', async (t) => {
  const host = await fixture(t)
  const response = await fetch(host.origin + '/__atlas/bootstrap')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    mode: 'service',
    scope,
    protocol: 'atlas.v1',
    socketPath: '/__atlas/ws',
  })
  assert.equal(
    (
      await fetch(host.origin + '/__atlas/bootstrap', {
        headers: { Origin: 'https://elsewhere.invalid' },
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await fetch(host.origin + '/__atlas/bootstrap', { method: 'HEAD' })
    ).headers.get('x-content-type-options'),
    'nosniff',
  )
  for (const options of [
    { origin: 'https://elsewhere.invalid' },
    { origin: undefined },
    { protocol: 'wrong.v1' },
    { path: '/__atlas/ws?token=foo' },
  ])
    await assert.rejects(host.connect(options), /403/)
  const client = await host.connect()
  assert.equal(
    (
      await client.request(
        frame('query', { operation: 'activity.read', payload: {} }),
      )
    ).error.code,
    'INVALID_INPUT',
  )
  assert.equal((await client.hello()).type, 'welcome')
  assert.equal(
    (
      await client.request(
        frame('query', { operation: 'activity.read', payload: {} }),
      )
    ).payload.session,
    host.service.session,
  )
  const closed = once(client.socket, 'close')
  client.send({
    ...frame('query', { operation: 'activity.read', payload: {} }),
    actor: 'admin',
  })
  assert.equal((await closed)[0], 1008)
  let other = false
  host.server.on('upgrade', (req, socket) => {
    if (req.url === '/hmr-fixture') {
      other = true
      socket.end('HTTP/1.1 418 Teapot\r\nContent-Length: 0\r\n\r\n')
    }
  })
  await assert.rejects(host.connect({ path: '/hmr-fixture' }), /418/)
  assert.equal(other, true)
})

test('stable command retries survive a lost socket without duplicate effects; outcome lookup is authoritative', async (t) => {
  const started = gate(),
    finish = gate()
  let executions = 0
  const host = await fixture(t, {
    definitions: [
      definition('fixture.generate', 'generate', async (ctx) => {
        executions++
        started.resolve()
        await finish.promise
        ctx.committed('fixture')
        return { done: true }
      }),
    ],
  })
  const one = await host.connect(),
    two = await host.connect()
  await one.hello()
  await two.hello()
  const command = frame('command', {
    commandId: randomUUID(),
    session: host.service.session,
    createdAt: new Date().toISOString(),
    operation: 'fixture.generate',
    payload: {},
  })
  const first = await one.request(command, 'accepted')
  await started.promise
  one.socket.terminate()
  const retry = { ...command, requestId: randomUUID() }
  const accepted = await two.request(retry, 'accepted')
  assert.equal(accepted.operationId, first.operationId)
  const result = two.wait(
    (message) =>
      message.type === 'result' && message.requestId === retry.requestId,
  )
  finish.resolve()
  assert.deepEqual((await result).payload, { done: true })
  assert.equal(executions, 1)
  const lookup = await two.request(
    frame('query', {
      operation: 'command.outcome',
      payload: { session: host.service.session, commandId: command.commandId },
    }),
  )
  assert.equal(lookup.payload.state, 'succeeded')
  assert.equal(lookup.payload.stages[0].committed, true)
  const old = await two.request(
    frame('command', {
      ...command,
      requestId: randomUUID(),
      commandId: randomUUID(),
      session: randomUUID(),
    }),
  )
  assert.equal(old.error.code, 'SESSION_CHANGED')
})

test('paused subscriptions deliver snapshot before buffered events and revoke delivery under changed policy', async (t) => {
  const entered = gate(),
    release = gate()
  let allow = true
  const policy = { mode: 'restricted', decide: () => ({ allowed: allow }) }
  const host = await fixture(t, {
    policy,
    snapshot: async (ctx, requested) => {
      entered.resolve()
      await release.promise
      return host.service.activity(ctx, requested)
    },
  })
  const client = await host.connect()
  await client.hello()
  const request = frame('subscribe', { topics: ['activity'] })
  const snapshot = client.request(request)
  await entered.promise
  const event = {
    scope,
    topic: 'activity',
    grants: [
      { action: 'pack.read', target: target(scope, 'pack', scope.packId) },
    ],
    payload: { marker: 'during-snapshot' },
  }
  host.service.invalidate(event)
  release.resolve()
  const subscription = (await snapshot).payload.subscriptions[0]
  const incremental = await client.wait((value) => value.type === 'event')
  assert.equal(incremental.subscriptionId, subscription.id)
  assert.equal(incremental.sequence, 1)
  assert.equal(incremental.payload.marker, 'during-snapshot')
  allow = false
  host.service.invalidate({ ...event, payload: { marker: 'private' } })
  assert.equal(
    (await client.wait((value) => value.type === 'resync')).reason,
    'policy',
  )
  assert.equal(
    (
      await client.request(
        frame('query', { operation: 'activity.read', payload: {} }),
      )
    ).error.code,
    'NOT_FOUND',
  )
  assert.equal(
    client.buffered.filter(
      (value) => value.type === 'event' && value.payload.marker === 'private',
    ).length,
    0,
  )
  assert.equal((await fetch(host.origin + '/__atlas/bootstrap')).status, 404)
})

test('large valid query and snapshot replies use scoped downloads without closing the socket', async (t) => {
  const payload = { text: 'source '.repeat(60000) }
  let denied = false
  const host = await fixture(t, {
    definitions: [
      {
        ...definition('fixture.read', 'query', async () => payload),
        targets: (ctx) => [
          {
            action: 'source.read',
            target: target(ctx.scope, 'source', 'large'),
          },
        ],
      },
    ],
    policy: {
      mode: 'restricted',
      decide: (_ctx, action) => ({
        allowed: !denied || action !== 'source.read',
      }),
    },
    snapshot: (ctx, scope) =>
      host.service.query(ctx, scope, 'fixture.read', {}),
  })
  const client = await host.connect()
  await client.hello()
  const received = await client.request(
    frame('query', { operation: 'fixture.read', payload: {} }),
    'result-reference',
  )
  assert.ok(received.reference)
  assert.ok(received.reference.byteLength > limits.outgoing)
  const response = await fetch(host.origin + received.reference.url)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), payload)
  const snapshot = await client.request(
    frame('subscribe', { topics: ['sources'] }),
    'result-reference',
  )
  assert.deepEqual(
    (await (await fetch(host.origin + snapshot.reference.url)).json())
      .subscriptions[0].snapshot,
    payload,
  )
  assert.equal(
    (
      await client.request(
        frame('query', { operation: 'activity.read', payload: {} }),
      )
    ).type,
    'result',
  )
  denied = true
  assert.equal((await fetch(host.origin + received.reference.url)).status, 404)
  assert.equal(
    (await fetch(host.origin + received.reference.url, { method: 'HEAD' }))
      .status,
    404,
  )
  assert.equal((await fetch(host.origin + snapshot.reference.url)).status, 404)
})

test('socket bounds reject excess requests and binary/oversized payloads; heartbeat terminates dead peers', async (t) => {
  const finish = gate()
  const host = await fixture(t, {
    definitions: [definition('fixture.read', 'query', () => finish.promise)],
    heartbeat: { pingMs: 40, pongMs: 30 },
  })
  const client = await host.connect()
  await client.hello()
  for (let index = 0; index < limits.outstanding; index++)
    client.send(frame('query', { operation: 'fixture.read', payload: {} }))
  const excess = await client.request(
    frame('query', { operation: 'fixture.read', payload: {} }),
  )
  assert.equal(excess.error.code, 'CAPACITY_REACHED')
  finish.resolve({ done: true })
  const binary = await host.connect()
  await binary.hello()
  const binaryClosed = once(binary.socket, 'close')
  binary.socket.send(Buffer.from('{}'))
  assert.equal((await binaryClosed)[0], 1003)
  const huge = await host.connect()
  await huge.hello()
  const hugeClosed = once(huge.socket, 'close')
  huge.socket.send(' '.repeat(limits.incoming + 1))
  assert.equal((await hugeClosed)[0], 1009)
  const dead = await host.connect({ autoPong: false })
  await dead.hello()
  assert.equal((await once(dead.socket, 'close'))[0], 1006)
})

test('snapshot event overflow explicitly requires resynchronization and leaves queries usable', async (t) => {
  const entered = gate(),
    release = gate()
  const host = await fixture(t, {
    snapshot: async (ctx, requested) => {
      entered.resolve()
      await release.promise
      return host.service.activity(ctx, requested)
    },
  })
  const client = await host.connect()
  await client.hello()
  const snapshot = client.request(frame('subscribe', { topics: ['activity'] }))
  await entered.promise
  for (let index = 0; index < 65; index++)
    host.service.invalidate({
      scope,
      topic: 'activity',
      grants: [],
      payload: { operation: { id: randomUUID(), state: 'running' } },
    })
  assert.equal(
    (await client.wait((value) => value.type === 'resync')).reason,
    'capacity',
  )
  release.resolve()
  assert.equal((await snapshot).error.code, 'CAPACITY_REACHED')
  assert.equal(
    (
      await client.request(
        frame('query', { operation: 'activity.read', payload: {} }),
      )
    ).type,
    'result',
  )
})

test('a real peer that stops reading is bounded and disconnected under output backpressure', async (t) => {
  const host = await fixture(t)
  const client = await host.connect()
  await client.hello()
  await client.request(frame('subscribe', { topics: ['sources'] }))
  // Pause TCP consumption, not just application event callbacks; exercise ws's real queue.
  client.socket._socket.pause()
  const started = Date.now()
  const closed = once(client.socket, 'close')
  const resume = setTimeout(() => client.socket._socket?.resume(), 6500)
  const deadline = setTimeout(() => client.socket.terminate(), 8500)
  try {
    for (let index = 0; index < 64; index++)
      host.service.invalidate({
        scope,
        topic: 'sources',
        grants: [],
        payload: { sources: [String(index)], text: 'x'.repeat(192 * 1024) },
      })
    const [code] = await closed
    assert.ok([1013, 1006].includes(code), `Unexpected closure ${code}`)
    // If only our deadline closed the peer, the transport failed to bound it.
    assert.ok(Date.now() - started < 8000)
  } finally {
    clearTimeout(resume)
    clearTimeout(deadline)
    client.socket._socket?.resume()
  }
})
