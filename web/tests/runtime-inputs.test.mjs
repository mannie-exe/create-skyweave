import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import test from 'node:test'
import { serverModInputs } from '../scripts/runtime-inputs.mjs'

const bytes = Buffer.from('verified mod')
const expected = {
  size: bytes.length,
  digests: { sha512: createHash('sha512').update(bytes).digest('hex') },
}
const file = (destination, layer, server = 'required') => ({
  expected,
  placements: [{ destination, layer, environment: { server } }],
})
const lock = (files) => ({
  runtime: {
    minecraft: '1.21.1',
    loader: 'neoforge',
    'loader-version': '21.1.264',
  },
  dependencies: { fixture: { files } },
})

test('capture selects the complete server set and default-enabled optional content', () => {
  const result = serverModInputs(
    '/fixture',
    lock([
      file('mods/common.jar', 'common'),
      file('mods/server.jar', 'server'),
      file('mods/client.jar', 'client', 'unsupported'),
      file('mods/optional.jar', 'common', {
        optional: 'group',
        'default-enabled': true,
      }),
      file('mods/off.jar', 'common', {
        optional: 'other',
        'default-enabled': false,
      }),
    ]),
    () => bytes,
  )
  assert.deepEqual(
    result.mods.map((mod) => mod.path),
    [
      resolve('/fixture/pack/mods/common.jar'),
      resolve('/fixture/overrides/server/mods/server.jar'),
      resolve('/fixture/pack/mods/optional.jar'),
    ],
  )
  assert.equal(result.runtime['loader-version'], '21.1.264')
})

test('missing and modified materialized bytes cannot certify a fresh snapshot', () => {
  const input = lock([file('mods/main.jar', 'common')])
  assert.throws(
    () =>
      serverModInputs('/fixture', input, () => {
        throw Error('missing')
      }),
    /materialized JAR missing/,
  )
  assert.throws(
    () => serverModInputs('/fixture', input, () => Buffer.alloc(bytes.length)),
    /sha512 mismatch/,
  )
})

test('ambiguous destinations, client-layer server mods and traversal fail', () => {
  for (const files of [
    [file('mods/main.jar', 'common'), file('mods/main.jar', 'server')],
    [file('mods/main.jar', 'client')],
    [file('mods/../../outside.jar', 'common')],
  ])
    assert.throws(() => serverModInputs('/fixture', lock(files), () => bytes))
})
