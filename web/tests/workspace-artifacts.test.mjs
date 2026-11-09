import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { target, scopeKey } from '../scripts/workspace/policy.ts'
import { hash } from '../scripts/workspace/identity.ts'
import { assertJson } from '../src/lib/workspace/contracts.ts'
import {
  scopedResourceLinks,
  assetProjectionFiles,
} from '../scripts/workspace/asset-projection.ts'

const actor = {
  principal: { kind: 'anonymous', id: 'local-open' },
  connectionId: randomUUID(),
}
const alpha = { workspaceId: 'local', packId: 'alpha' },
  beta = { workspaceId: 'local', packId: 'beta' }
async function fixture(t, bundle = false) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-artifacts-')),
  )
  const staging = path.join(directory, 'candidate')
  await fs.mkdir(staging)
  const registrations = [alpha, beta].map((scope) => ({
    scope,
    web: directory,
    pack: directory,
  }))
  let permitted = true,
    forbiddenId = '',
    stale = false,
    service
  const store = createArtifactStore({
    root: path.join(directory, 'artifacts'),
    registrations,
    can: (ctx, grant) => service.can(ctx, grant),
  })
  const policy = {
    mode: 'restricted',
    decide: (_ctx, action, resource) => ({
      allowed:
        (action !== 'pack.read' || permitted) &&
        (action !== 'artifact.read' || resource.id !== forbiddenId),
    }),
  }
  service = createWorkspaceService({
    registrations,
    policy,
    definitions: [
      defineOperation({
        name: 'fixture.generate',
        effect: 'generate',
        input: z.strictObject({}),
        output: z.unknown(),
        label: 'Publish fixture',
        href: '/',
        success: 'Published',
        targets: (ctx) => [
          {
            action: 'generation.run',
            target: target(ctx.scope, 'projection', 'fixture'),
          },
        ],
        execute: (ctx) =>
          store.publish(ctx, {
            namespace: 'fixture',
            staging,
            inputs: { source: hash('fixture') },
            files: {
              'payload.json': path.join(staging, 'payload.json'),
              'clip.mp4': path.join(staging, 'clip.mp4'),
              ...(bundle
                ? { 'index.json': path.join(staging, 'index.json') }
                : {}),
            },
            ...(bundle
              ? {
                  rewriteJSON: (value, references) =>
                    scopedResourceLinks('/candidate/', value, references),
                }
              : {}),
            async recheck() {
              if (stale) {
                const error = new Error('stale candidate')
                error.code = 'stale'
                throw error
              }
            },
          }),
      }),
    ],
  })
  const server = createServer(
    (req, res) =>
      void store.http(actor, req, res).then((handled) => {
        if (!handled) res.writeHead(404).end()
      }),
  )
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await service.dispose()
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(directory, { recursive: true, force: true })
  })
  await fs.writeFile(
    path.join(staging, 'payload.json'),
    JSON.stringify({
      message: '<img src=x onerror=alert(1)>',
      ...(bundle ? { clip: '/candidate/clip.mp4?v=fixture' } : {}),
    }),
  )
  await fs.writeFile(path.join(staging, 'clip.mp4'), Buffer.from('0123456789'))
  if (bundle)
    await fs.writeFile(
      path.join(staging, 'index.json'),
      JSON.stringify({ preview: '/candidate/payload.json' }),
    )
  async function publish(scope) {
    const command = {
      v: 1,
      type: 'command',
      requestId: randomUUID(),
      commandId: randomUUID(),
      session: service.session,
      scope,
      createdAt: new Date().toISOString(),
      operation: 'fixture.generate',
      payload: {},
    }
    return (await service.submit(actor, command)).outcome
  }
  return {
    store,
    publish,
    staging,
    directory,
    origin: `http://127.0.0.1:${server.address().port}`,
    permit: (value) => {
      permitted = value
    },
    denyArtifact: (value) => {
      forbiddenId = value
    },
    setStale: () => {
      stale = true
    },
  }
}

test('shared artifact bytes retain separate scope ownership; GET/HEAD, ranges and policy enforce the same references', async (t) => {
  const f = await fixture(t),
    first = (await f.publish(alpha)).payload,
    second = (await f.publish(beta)).payload
  const a = first.files['payload.json'],
    b = second.files['payload.json']
  assert.equal(a.sha256, b.sha256)
  assert.notEqual(a.id, b.id)
  assert.equal((await f.store.resolve(actor, alpha, a.id)).reference.id, a.id)
  await assert.rejects(f.store.resolve(actor, beta, a.id))
  await assert.rejects(f.store.resolve(actor, alpha, a.sha256))
  const response = await fetch(f.origin + a.url)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await response.json()).message, '<img src=x onerror=alert(1)>')
  const clip = first.files['clip.mp4']
  const partial = await fetch(f.origin + clip.url, {
    headers: { Range: 'bytes=2-5' },
  })
  assert.equal(partial.status, 206)
  assert.equal(await partial.text(), '2345')
  assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10')
  const head = await fetch(f.origin + clip.url, {
    method: 'HEAD',
    headers: { Range: 'bytes=-3' },
  })
  assert.equal(head.status, 206)
  assert.equal(head.headers.get('content-length'), '3')
  assert.equal(await head.text(), '')
  assert.equal(
    (await fetch(f.origin + clip.url, { headers: { Range: 'bytes=99-' } }))
      .status,
    416,
  )
  assert.equal(
    (await fetch(f.origin + clip.url, { headers: { Range: 'bytes=0-1,5-6' } }))
      .status,
    416,
  )
  f.denyArtifact(a.id)
  assert.equal(
    (await f.store.active(actor, alpha, 'fixture')).files['payload.json'],
    undefined,
  )
  for (const method of ['GET', 'HEAD'])
    assert.equal((await fetch(f.origin + a.url, { method })).status, 404)
  f.denyArtifact('')
  f.permit(false)
  // Knowing a child/hash does not grant parent access.
  assert.equal((await fetch(f.origin + b.url)).status, 404)
  await assert.rejects(f.store.active(actor, beta, 'fixture'))
})

test('publication rejects stale candidates and unsafe files while preserving old generations and immutable bytes', async (t) => {
  const f = await fixture(t),
    first = (await f.publish(alpha)).payload
  const reference = first.files['payload.json']
  await fs.writeFile(
    path.join(f.staging, 'payload.json'),
    JSON.stringify({ message: 'second' }),
  )
  const second = (await f.publish(alpha)).payload
  assert.notEqual(first.id, second.id)
  assert.equal((await f.store.active(actor, alpha, 'fixture')).id, second.id)
  assert.equal((await fetch(f.origin + reference.url)).status, 200)
  assert.match(await (await fetch(f.origin + reference.url)).text(), /onerror/)
  f.setStale()
  await fs.writeFile(path.join(f.staging, 'payload.json'), '{"candidate":true}')
  const failed = await f.publish(alpha)
  assert.equal(failed.operation.state, 'failed')
  assert.equal((await f.store.active(actor, alpha, 'fixture')).id, second.id)
  assert.equal(failed.operation.stages.length, 0)
  const resolved = await f.store.resolve(actor, alpha, reference.id)
  await fs.unlink(resolved.file)
  const outside = path.join(f.directory, 'outside.json')
  await fs.writeFile(outside, 'private')
  await fs.symlink(outside, resolved.file)
  assert.equal((await fetch(f.origin + reference.url)).status, 404)
  assert.match(scopeKey(second.scope), /local\/alpha/)
})

test('a symlinked artifact directory cannot create candidate files outside its owned root', async (t) => {
  const f = await fixture(t)
  await f.store.active(actor, alpha, 'fixture')
  const outside = path.join(f.directory, 'outside-directory')
  await fs.mkdir(outside)
  await fs.symlink(outside, path.join(f.directory, 'artifacts/blobs'), 'dir')
  assert.equal((await f.publish(alpha)).operation.state, 'failed')
  assert.deepEqual(await fs.readdir(outside), [])
})

test('a generated bundle resolves media and JSON dependencies within one scoped generation', async (t) => {
  const f = await fixture(t, true),
    first = (await f.publish(alpha)).payload
  const index = await fetch(f.origin + first.files['index.json'].url).then(
    (response) => response.json(),
  )
  assert.equal(index.preview, first.files['payload.json'].url)
  const preview = await fetch(f.origin + index.preview).then((response) =>
    response.json(),
  )
  assert.equal(preview.clip, first.files['clip.mp4'].url)
  assert.equal((await fetch(f.origin + preview.clip)).status, 200)
  await fs.writeFile(
    path.join(f.staging, 'payload.json'),
    JSON.stringify({ clip: '/candidate/missing.mp4' }),
  )
  const failed = await f.publish(alpha)
  assert.equal(failed.error.code, 'GENERATION_FAILED')
  assert.equal((await f.store.active(actor, alpha, 'fixture')).id, first.id)
  const preserved = await fetch(f.origin + index.preview).then((response) =>
    response.json(),
  )
  assert.equal(preserved.clip, preview.clip)
})

test('resource output collection rejects invalid images and unexpected files', async (t) => {
  const f = await fixture(t),
    candidate = path.join(f.directory, 'textures')
  await fs.mkdir(candidate)
  await fs.writeFile(path.join(candidate, 'index.json'), '{}')
  await fs.writeFile(path.join(candidate, 'texture.png'), 'invalid PNG')
  await assert.rejects(assetProjectionFiles(candidate), /not a PNG/)
  await fs.writeFile(
    path.join(candidate, 'texture.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8\/x8AAwMCAO+ip1kAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  assert.deepEqual(Object.keys(await assetProjectionFiles(candidate)).sort(), [
    'index.json',
    'texture.png',
  ])
  await fs.writeFile(path.join(candidate, 'unexpected.sh'), 'unused')
  await assert.rejects(assetProjectionFiles(candidate), /Unexpected/)
})

test('explicit generated JSON budgets admit wide native data without increasing transport defaults', () => {
  const value = Array(1_000_001).fill(0)
  assert.throws(() => assertJson(value), /too complex/)
  assert.doesNotThrow(() => assertJson(value, 4 * 1024 * 1024))
  assert.throws(
    () => assertJson({ bad: Infinity }, 4 * 1024 * 1024),
    /JSON values/,
  )
  const cyclic = {}
  cyclic.self = cyclic
  assert.throws(() => assertJson(cyclic, 4 * 1024 * 1024), /Cyclic/)
})

test('map output has a measured JSON budget; resource previews retain their smaller cap and SVG stays passive', async (t) => {
  const f = await fixture(t),
    candidate = path.join(f.directory, 'map')
  await fs.mkdir(candidate)
  const bytes = Buffer.alloc(17 * 1024 * 1024, 32)
  bytes.write('{}')
  await fs.writeFile(path.join(candidate, 'catalog.json'), bytes)
  await assert.rejects(
    assetProjectionFiles(candidate, 'catalog.json'),
    /JSON exceeds/,
  )
  assert.ok(
    (await assetProjectionFiles(candidate, 'catalog.json', 'map'))[
      'catalog.json'
    ],
  )
  // The native provenance domain is about 56 MiB; keep the map-only 64 MiB
  // admission boundary explicit rather than lifting every resource-file limit.
  await fs.writeFile(
    path.join(candidate, 'catalog.json'),
    Buffer.from('"' + 'x'.repeat(56 * 1024 * 1024) + '"'),
  )
  assert.ok(
    (await assetProjectionFiles(candidate, 'catalog.json', 'map'))[
      'catalog.json'
    ],
  )
  await fs.writeFile(
    path.join(candidate, 'catalog.json'),
    Buffer.alloc(64 * 1024 * 1024 + 1, 32),
  )
  await assert.rejects(
    assetProjectionFiles(candidate, 'catalog.json', 'map'),
    /JSON exceeds/,
  )
  await fs.writeFile(path.join(candidate, 'catalog.json'), bytes)
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1kAAAAASUVORK5CYII='
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" image-rendering="pixelated"><image width="1" height="1" href="data:image/png;base64,${png}"/></svg>`
  await fs.writeFile(path.join(candidate, 'icon.svg'), svg)
  assert.ok(
    (await assetProjectionFiles(candidate, 'catalog.json', 'map'))['icon.svg'],
  )
  for (const invalid of [
    svg.replace('<image ', '<script/> <image '),
    svg.replace(
      'data:image/png;base64,' + png,
      'https://example.invalid/image.png',
    ),
  ]) {
    await fs.writeFile(path.join(candidate, 'icon.svg'), invalid)
    await assert.rejects(
      assetProjectionFiles(candidate, 'catalog.json', 'map'),
      /Unsupported generated SVG/,
    )
  }
})
