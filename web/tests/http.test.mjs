import test from 'node:test'
import assert from 'node:assert/strict'
import { requestJSON } from '../src/lib/http.ts'

test('JSON null remains a valid empty snapshot even without a JSON media type', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('null'))
  assert.equal(await requestJSON('/generated/world.json'), null)
})

test('shared JSON transport preserves GET and explicit JSON POST semantics', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return Response.json({ revision: 'saved' })
  })
  assert.deepEqual(await requestJSON('/generated/catalog.json'), {
    revision: 'saved',
  })
  await requestJSON('/legacy-write', {
    text: 'source',
    revision: 'before',
  })
  assert.equal(calls[0].options.cache, 'no-store')
  assert.equal(calls[0].options.method, undefined)
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    text: 'source',
    revision: 'before',
  })
})

test('shared transport preserves conflict messages and explains absent local endpoints', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'File changed on disk' }, { status: 409 }),
  )
  await assert.rejects(requestJSON('/legacy-write', {}), /File changed on disk/)
  fetch.mock.mockImplementation(
    async () =>
      new Response('<html>404</html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      }),
  )
  await assert.rejects(
    requestJSON('/__atlas/missing'),
    /Local editing requires pnpm dev/,
  )
  await assert.rejects(
    requestJSON('/generated/catalog.json'),
    /expected JSON \(HTTP 404\)/,
  )
})
