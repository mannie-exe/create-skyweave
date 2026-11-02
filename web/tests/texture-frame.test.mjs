import assert from 'node:assert/strict'
import test from 'node:test'
import { textureFrame } from '../src/lib/texture-frame.ts'

test('frame time and two-dimensional layout agree across synchronized previews', () => {
  const source = {
    width: 32,
    height: 32,
    frameWidth: 16,
    frameHeight: 16,
    animation: { frametime: 2, frames: [0, { index: 3, time: 1 }, 1] },
  }
  assert.equal(textureFrame(source, 99).index, 0)
  assert.deepEqual(textureFrame(source, 100), {
    index: 3,
    repeat: [0.5, 0.5],
    offset: [0.5, 0],
  })
  assert.equal(textureFrame(source, 150).index, 1)
  assert.equal(textureFrame(source, 250).index, 0)
})

test('static atlases and ordinary vertical strips preserve the existing coordinate mapping', () => {
  assert.deepEqual(
    textureFrame(
      { width: 64, height: 64, frameHeight: 64, animation: null },
      1000,
    ),
    { index: 0, repeat: [1, 1], offset: [0, 0] },
  )
  assert.deepEqual(
    textureFrame(
      { width: 16, height: 64, frameHeight: 16, animation: { frametime: 1 } },
      50,
    ),
    { index: 1, repeat: [1, 0.25], offset: [0, 0.5] },
  )
})
