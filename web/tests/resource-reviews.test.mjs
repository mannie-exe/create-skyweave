import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { resourceReviews } from '../scripts/resource-reviews.mjs'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { reviewDefinitions } from '../scripts/workspace/reviews.ts'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'sky-resource-reviews-')),
  )
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'data/authored'), { recursive: true })
  await fs.mkdir(path.join(root, 'data/research/resourcepacks'), {
    recursive: true,
  })
  await fs.mkdir(path.join(root, 'authoring'), { recursive: true })
  await fs.copyFile(
    '../authoring/resource-selections.json',
    path.join(root, 'authoring/resource-selections.json'),
  )
  await fs.copyFile(
    'data/research/resourcepacks/local-media.json',
    path.join(root, 'data/research/resourcepacks/local-media.json'),
  )
  const file = path.join(root, 'data/authored/resource-reviews.json')
  await fs.writeFile(
    file,
    JSON.stringify({
      schema: 1,
      reviews: {
        'retired/example': { preference: 'old', notes: 'Keep this evidence' },
      },
    }),
  )
  const scope = { workspaceId: 'local', packId: 'fixture' }
  const registration = { scope, web: root, pack: root }
  let denied = false
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const service = createWorkspaceService({
    registrations: [registration],
    definitions: reviewDefinitions([registration]),
    policy: {
      mode: 'restricted',
      decide: (_ctx, action, target) => ({
        allowed:
          !denied ||
          !(action === 'review.write' || target.id === 'review-media'),
      }),
    },
  })
  t.after(() => service.dispose())
  const editor = {
    read: () => service.query(actor, scope, 'reviews.read', {}),
    save: async (payload) => {
      const result = await (
        await service.submit(actor, {
          v: 1,
          type: 'command',
          requestId: randomUUID(),
          commandId: randomUUID(),
          session: service.session,
          createdAt: new Date().toISOString(),
          scope,
          operation: 'reviews.save',
          payload,
        })
      ).outcome
      if (result.error)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        })
      return result.payload
    },
  }

  const initial = await editor.read()
  const input = {
    revision: initial.revision,
    evidence: initial.evidence,
    feature: 'barrels',
    review: { preference: 'nautilus-3d', notes: 'Compare the edge depth.' },
  }
  return {
    root,
    file,
    editor,
    initial,
    input,
    service,
    deny: () => {
      denied = true
    },
    staticRead: () => resourceReviews(root).read(),
  }
}

test('save and reload a dated review without changing unrelated reviews', async (t) => {
  const { root, file, editor, initial, input } = await fixture(t)
  const saved = await editor.save(input)
  assert.notEqual(saved.revision, initial.revision)
  const { catalogue, selections, ...reloaded } = await editor.read()
  assert.deepEqual(reloaded, saved)
  assert(catalogue.some((feature) => feature.id === 'barrels'))
  assert(Array.isArray(selections))
  assert.equal(
    saved.document.reviews['retired/example'].notes,
    'Keep this evidence',
  )
  assert.equal(
    saved.document.reviews['selective-20261101/barrels'].preference,
    'nautilus-3d',
  )
  assert.equal(
    saved.document.reviews['selective-20261101/barrels'].evidence,
    saved.evidence,
  )
  assert.deepEqual(await fs.readdir(path.dirname(file)), [
    'resource-reviews.json',
  ])
  assert.deepEqual((await fs.readdir(root)).sort(), [
    '.cache',
    'authoring',
    'data',
  ])
})

test('stale sources/evidence and invalid inputs cannot overwrite reviews', async (t) => {
  const { file, editor, initial, input } = await fixture(t)
  for (const changes of [
    { revision: 'stale' },
    { evidence: 'old-captures' },
    { feature: '../outside' },
    { command: 'anything' },
    { review: { preference: 'unknown', notes: '' } },
    { review: { preference: 'current', notes: 'x'.repeat(4001) } },
    { review: { preference: 'current', notes: '', command: 'extra' } },
  ])
    await assert.rejects(editor.save({ ...input, ...changes }))
  assert.deepEqual(await editor.read(), initial)
  await fs.appendFile(file, '\n')
  await assert.rejects(editor.save(input), /changed/)
  assert.equal(
    (await editor.read()).document.reviews['selective-20261101/barrels'],
    undefined,
  )
})

test('fixed staging links are ignored and source symlinks cannot redirect review writes', async (t) => {
  const { root, file, editor, input } = await fixture(t)
  const outside = path.join(root, 'outside.json')
  await fs.writeFile(outside, 'untouched')
  await fs.symlink(outside, file + '.tmp')
  await editor.save(input)
  assert.equal(await fs.readFile(outside, 'utf8'), 'untouched')
  await fs.unlink(file)
  await fs.symlink(outside, file)
  await assert.rejects(editor.read(), /symlinks/)
  await assert.rejects(editor.save(input), /symlinks/)
})

test('capture evidence updates conflict independently; denied review data and writes stay unavailable', async (t) => {
  const { root, editor, input, initial, deny, staticRead } = await fixture(t)
  const { catalogue, selections, ...sourceOnly } = initial
  assert.deepEqual(await staticRead(), sourceOnly)
  const file = path.join(root, 'data/research/resourcepacks/local-media.json')
  const media = JSON.parse(await fs.readFile(file, 'utf8'))
  media.runs['selective-20261101'].context += ' Fixture capture update.'
  await fs.writeFile(file, JSON.stringify(media))
  const next = await editor.read()
  assert.equal(next.revision, initial.revision)
  assert.notEqual(next.evidence, initial.evidence)
  assert(next.catalogue[0].context.endsWith('Fixture capture update.'))
  const selectedFile = path.join(root, 'authoring/resource-selections.json')
  const selected = JSON.parse(await fs.readFile(selectedFile, 'utf8'))
  selected.selections = []
  await fs.writeFile(selectedFile, JSON.stringify(selected))
  assert.deepEqual((await editor.read()).selections, [])
  await assert.rejects(editor.save(input), { code: 'REVISION_CONFLICT' })
  deny()
  await assert.rejects(editor.read(), /unavailable|authorized/)
  await assert.rejects(
    editor.save({ ...input, evidence: next.evidence }),
    /unavailable|authorized/,
  )
  assert.deepEqual((await staticRead()).document, initial.document)
})

// A new capture run must not overwrite notes from an older comparison catalogue.
test('repair preferences use their own capture run and preserve prior choices', async (t) => {
  const { editor, input } = await fixture(t)
  const old = await editor.save(input)
  const repair = await editor.save({
    revision: old.revision,
    evidence: old.evidence,
    feature: 'bridge-lantern',
    review: { preference: 'defer', notes: 'Review stair attachment first.' },
  })
  assert.equal(
    repair.document.reviews['lantern-hanging-20261103/bridge-lantern']
      .preference,
    'defer',
  )
  assert.equal(
    repair.document.reviews['selective-20261101/barrels'].preference,
    'nautilus-3d',
  )
  assert.equal(
    repair.document.reviews['selective-20261101/bridge-lantern'],
    undefined,
  )
})
