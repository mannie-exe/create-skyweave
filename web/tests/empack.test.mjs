import test from 'node:test'
import assert from 'node:assert/strict'
import { currentEmpackAuthor, currentEmpackLock } from '../src/lib/empack.mjs'
import { clientResourceInputs } from '../scripts/resource-inputs.mjs'
import { serverModDeclarations } from '../scripts/runtime-inputs.mjs'

test('author inputs require current Java preference and schema', () => {
  const author = { schema: 6, runtime: { java: { preferred: 21 } } }
  assert.equal(currentEmpackAuthor(author), author)
  for (const old of [
    { ...author, schema: 5 },
    { schema: 6, runtime: { java: 21 } },
  ])
    assert.throws(() => currentEmpackAuthor(old), /author schema 6/)
})

test('resource and runtime readers refuse old locks before projecting content', () => {
  const lock = { schema: 3, runtime: {}, dependencies: {} }
  assert.equal(currentEmpackLock(lock), lock)
  assert.deepEqual(clientResourceInputs('/pack', lock).inputs, [])
  assert.deepEqual(serverModDeclarations('/pack', lock).mods, [])
  for (const schema of [undefined, 2, 4]) {
    const old = { ...lock, schema }
    assert.throws(() => clientResourceInputs('/pack', old), /lock schema 3/)
    assert.throws(() => serverModDeclarations('/pack', old), /lock schema 3/)
  }
})
