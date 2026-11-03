import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createResultDelivery } from '../scripts/workspace/result-delivery.ts'

test('reply downloads retain source authority, scope, expiry and bounded storage', async (t) => {
  let clock = 0,
    denied = false,
    read = true
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const scope = { workspaceId: 'local', packId: 'fixture' }
  const store = createResultDelivery({
    now: () => clock,
    ttlMs: 100,
    maxEntries: 1,
    maxBytes: 500,
    can: async (_ctx, grant) => {
      assert.equal(grant.action, 'artifact.read')
      return read
    },
  })
  const delivery = {
    payload: { text: 'exact bytes' },
    authorize: async () => {
      if (denied) throw new Error('Denied')
    },
  }
  const server = createServer((req, res) => {
    void store.http(actor, req, res).then((handled) => {
      if (!handled) res.writeHead(404).end()
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  t.after(async () => {
    store.dispose()
    await new Promise((resolve) => server.close(resolve))
  })
  const reference = await store.publish(actor, scope, delivery)
  assert.deepEqual(
    await (await fetch(origin + reference.url)).json(),
    delivery.payload,
  )
  const head = await fetch(origin + reference.url, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), String(reference.byteLength))
  assert.equal(await head.text(), '')
  assert.equal(
    (await fetch(origin + reference.url.replace('/fixture/', '/other/')))
      .status,
    404,
  )
  await assert.rejects(store.publish(actor, scope, delivery), {
    code: 'CAPACITY_REACHED',
  })
  denied = true
  assert.equal((await fetch(origin + reference.url)).status, 404)
  denied = false
  read = false
  assert.equal((await fetch(origin + reference.url)).status, 404)
  read = true
  clock = 101
  assert.equal((await fetch(origin + reference.url)).status, 404)
  const next = await store.publish(actor, scope, delivery)
  assert.equal((await fetch(origin + next.url)).status, 200)
  store.dispose()
  assert.equal((await fetch(origin + next.url)).status, 404)
})

test('concurrent reply admission cannot overflow storage after asynchronous policy checks', async () => {
  const authorization = Promise.withResolvers()
  const store = createResultDelivery({
    maxEntries: 1,
    can: () => authorization.promise,
  })
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const scope = { workspaceId: 'local', packId: 'fixture' }
  const delivery = { payload: { saved: true }, authorize: async () => {} }
  const attempts = [
    store.publish(actor, scope, delivery),
    store.publish(actor, scope, delivery),
  ]
  authorization.resolve(true)
  const settled = await Promise.allSettled(attempts)
  assert.equal(
    settled.filter((entry) => entry.status === 'fulfilled').length,
    1,
  )
  assert.equal(
    settled.find((entry) => entry.status === 'rejected').reason.code,
    'CAPACITY_REACHED',
  )
  store.dispose()
  await assert.rejects(store.publish(actor, scope, delivery), {
    code: 'STORAGE_UNAVAILABLE',
  })
})
