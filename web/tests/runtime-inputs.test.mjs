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
  schema: 3,
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

test('local candidates bind the accepted SHA-256 observation as well as declared hashes', () => {
  const candidate = file('mods/local.jar', 'common')
  candidate.expected = {
    size: bytes.length,
    digests: null,
    'accepted-observation': createHash('sha256').update(bytes).digest('hex'),
  }
  assert.equal(
    serverModInputs('/fixture', lock([candidate]), () => bytes).mods.length,
    1,
  )
  assert.throws(
    () =>
      serverModInputs('/fixture', lock([candidate]), () =>
        Buffer.alloc(bytes.length),
      ),
    /sha256 mismatch/,
  )
  candidate.expected.digests = expected.digests
  candidate.expected['accepted-observation'] = '0'.repeat(64)
  assert.throws(
    () => serverModInputs('/fixture', lock([candidate]), () => bytes),
    /sha256 mismatch/,
  )
  candidate.expected['accepted-observation'] = 'not-a-content-id'
  assert.throws(
    () => serverModInputs('/fixture', lock([candidate]), () => bytes),
    /invalid accepted observation/,
  )
  delete candidate.expected['accepted-observation']
  candidate.expected.digests = null
  assert.throws(
    () => serverModInputs('/fixture', lock([candidate]), () => bytes),
    /no locked digest/,
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
