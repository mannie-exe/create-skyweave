import type { TextureSource } from './model-preview'

/** Select a texture frame without evaluating model animations or game state. */
export function textureFrame(source: TextureSource, milliseconds: number) {
  const width = source.frameWidth ?? source.width
  const height = source.frameHeight
  const columns = source.width / width
  const count = columns * (source.height / height)
  const sequence =
    source.animation?.frames ?? Array.from({ length: count }, (_, i) => i)
  const frames = sequence.map((entry) =>
    typeof entry === 'number'
      ? { index: entry, time: source.animation?.frametime ?? 1 }
      : {
          index: entry.index,
          time: entry.time ?? source.animation?.frametime ?? 1,
        },
  )
  let tick =
    Math.floor(Math.max(0, milliseconds) / 50) %
    frames.reduce((sum, frame) => sum + frame.time, 0)
  let index = frames[0].index
  for (const frame of frames) {
    index = frame.index
    if (tick < frame.time) break
    tick -= frame.time
  }
  return {
    index,
    repeat: [width / source.width, height / source.height],
    offset: [
      ((index % columns) * width) / source.width,
      1 - ((Math.floor(index / columns) + 1) * height) / source.height,
    ],
  }
}
