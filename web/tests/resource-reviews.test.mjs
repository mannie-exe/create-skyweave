import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { resourceReviews } from '../scripts/resource-reviews.mjs'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'sky-resource-reviews-')),
  )
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'data/authored'), { recursive: true })
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
  const editor = resourceReviews(root)
  const initial = await editor.read()
  const input = {
    revision: initial.revision,
    evidence: initial.evidence,
    feature: 'barrels',
    review: { preference: 'nautilus-3d', notes: 'Compare the edge depth.' },
  }
  return { root, file, editor, initial, input }
}

test('save and reload a dated review without changing unrelated reviews', async (t) => {
  const { root, file, editor, initial, input } = await fixture(t)
  const saved = await editor.save(input)
  assert.notEqual(saved.revision, initial.revision)
  assert.deepEqual(await editor.read(), saved)
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
  assert.deepEqual(await fs.readdir(root), ['data'])
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

test('source and staging symlinks cannot redirect review writes', async (t) => {
  const { root, file, editor, input } = await fixture(t)
  const outside = path.join(root, 'outside.json')
  await fs.writeFile(outside, 'untouched')
  await fs.symlink(outside, file + '.tmp')
  await assert.rejects(editor.save(input), /EEXIST/)
  assert.equal(await fs.readFile(outside, 'utf8'), 'untouched')
  await fs.unlink(file)
  await fs.symlink(outside, file)
  await assert.rejects(editor.read(), /symlinks/)
})
