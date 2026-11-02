import assert from 'node:assert/strict'
import test from 'node:test'
import { clientResourceInputs } from '../scripts/resource-inputs.mjs'
const lock = (destination, layer = 'common', client = 'required') => ({
  runtime: { minecraft: '1.21.1' },
  dependencies: {
    fixture: {
      files: [
        {
          expected: { digests: { sha512: 'locked' } },
          placements: [{ destination, layer, environment: { client } }],
        },
      ],
    },
  },
})

test('resource projection keeps client participation and authored placement distinct', () => {
  assert.equal(
    clientResourceInputs('/pack', lock('resourcepacks/art.zip')).inputs[0].path,
    '/pack/pack/resourcepacks/art.zip',
  )
  assert.equal(
    clientResourceInputs('/pack', lock('mods/visual.jar', 'client')).inputs[0]
      .path,
    '/pack/overrides/client/mods/visual.jar',
  )
  assert.equal(
    clientResourceInputs(
      '/pack',
      lock('mods/off.jar', 'common', {
        optional: 'feature',
        'default-enabled': false,
      }),
    ).inputs.length,
    0,
  )
  assert.throws(
    () => clientResourceInputs('/pack', lock('mods/client.jar', 'server')),
    /invalid client resource layer/,
  )
  assert.equal(
    clientResourceInputs('/pack', lock('mods/../../escape.jar')).inputs.length,
    0,
  )
})
