import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { projectionAlias } from '../scripts/workspace/delivery.ts'
import { withWorkspace } from '../scripts/workspace-cli.mjs'
import { domains } from '../src/lib/domains.mjs'
import {
  publicProjectionJSON,
  publicProjectionHeads,
} from '../scripts/workspace/public-read.ts'

async function fixture(t) {
  const root = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-delivery-')),
    ),
    scope = { workspaceId: 'local', packId: 'create_skyweave' },
    registration = { scope, web: root, pack: root },
    actor = {
      principal: { kind: 'anonymous', id: 'fixture' },
      connectionId: randomUUID(),
    }
  let permitted = true
  const artifacts = createArtifactStore({
    root: path.join(root, '.cache/workspace/artifacts'),
    registrations: [registration],
    can: async () => permitted,
  })
  const server = createServer((request, response) => {
    void projectionAlias(artifacts, actor, scope, request, response).then(
      (handled) => {
        if (!handled) response.writeHead(200).end('public evidence fallback')
      },
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await artifacts.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  return {
    root,
    scope,
    artifacts,
    actor,
    deny() {
      permitted = false
    },
    request: (name, options) =>
      fetch(`http://127.0.0.1:${server.address().port}${name}`, options),
    async publish(text) {
      const staging = path.join(root, 'candidate')
      await fs.mkdir(staging, { recursive: true })
      const file = path.join(staging, 'catalog.json')
      await fs.writeFile(file, text)
      return artifacts.publish(
        {
          ...actor,
          scope,
          authorize: async () => {},
          committed() {},
          invalidate() {},
        },
        {
          staging,
          namespace: 'map',
          files: { 'catalog.json': file },
          inputs: {},
          recheck: async () => {},
        },
      )
    },
  }
}

test('live aliases never fall through to raw public files when missing, denied or malformed', async (t) => {
  const f = await fixture(t)
  for (const route of [
    '/generated/catalog.json',
    '/generated/objects/index.json',
    '/generated/texture-resources/index.json',
    '/generated/unknown.json',
    '/generated/resource-review/private.json',
  ])
    assert.equal((await f.request(route)).status, 404, route)
  const generation = await f.publish('{"current":true}')
  let response = await f.request('/generated/catalog.json')
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '{"current":true}')
  assert.match(response.headers.get('content-type'), /application\/json/)
  response = await f.request('/generated/catalog.json', { method: 'HEAD' })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '')
  assert.equal((await f.request('/generated/domains.json')).status, 404)
  assert.equal(
    (await f.request('/generated/catalog.json', { method: 'POST' })).status,
    404,
  )
  f.deny()
  assert.equal((await f.request('/generated/catalog.json')).status, 404)
  assert.equal(
    (await f.request('/generated/resource-review/fixture-overview.png')).status,
    200,
  )
  assert.equal(
    (await f.request('/generated/design-preview/glider.png')).status,
    200,
  )
  assert.equal(
    (await f.request('/generated/resource-review/../objects/index.json'))
      .status,
    404,
  )
  assert.equal(generation.namespace, 'map')
})

test('CLI runtime reads current scoped projections without a socket, native job or legacy cache fallback', async (t) => {
  const f = await fixture(t)
  await fs.mkdir(path.join(f.root, 'data/authored'), { recursive: true })
  await fs.writeFile(
    path.join(f.root, 'data/local.example.json'),
    JSON.stringify({ pack: '.' }),
  )
  for (const domain of domains)
    await fs.writeFile(
      path.join(f.root, 'data/authored', domain + '.yml'),
      'schema: 1\n',
    )
  const first = await f.publish('{"fresh":1}')
  await withWorkspace(f.root, async (workspace) => {
    const files = await workspace.query('map.sources.read')
    assert.equal(Object.keys(files.files).length, domains.length)
    const file = await workspace.projection('map', 'catalog.json')
    assert.equal(await fs.readFile(file, 'utf8'), '{"fresh":1}')
    await assert.rejects(
      workspace.projection('map', 'domains.json'),
      (error) => error.code === 'NOT_FOUND',
    )
    const activity = await workspace.query('activity.read')
    assert.equal(activity.current, null)
    assert.equal(activity.history.length, 0)
  })
  await assert.rejects(
    fs.access(
      path.join(f.root, '.cache/workspace/local/create_skyweave/processes'),
    ),
  )
  assert.equal(first.namespace, 'map')
})

test('server-rendered public metadata uses admitted heads and never a stale public cache', async (t) => {
  const f = await fixture(t),
    registration = { scope: f.scope, web: f.root, pack: f.root }
  await fs.mkdir(path.join(f.root, 'public/generated'), { recursive: true })
  await fs.writeFile(
    path.join(f.root, 'public/generated/catalog.json'),
    '{"stale":true}',
  )
  assert.equal(
    await publicProjectionJSON(registration, 'map', 'catalog.json'),
    undefined,
  )
  const current = await f.publish('{"current":true}')
  assert.deepEqual(
    await publicProjectionJSON(registration, 'map', 'catalog.json'),
    { current: true },
  )
  assert.deepEqual(
    await publicProjectionHeads(registration, ['map', 'objects']),
    { map: current.id, objects: null },
  )
})
