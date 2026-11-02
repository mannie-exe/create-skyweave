import { useEffect, useRef } from 'react'
import type { TextureSource } from '../../lib/model-preview'
import { textureFrame } from '../../lib/texture-frame'

type Props = {
  source: TextureSource
  label: string
  paused: boolean
  freezeTime: number
  clipPath?: string
}
export default function TextureFrame({
  source,
  label,
  paused,
  freezeTime,
  clipPath,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let frame = 0,
      active = true
    const image = new Image(),
      target = canvas.current!,
      context = target.getContext('2d')!
    const width = source.frameWidth ?? source.width,
      height = source.frameHeight
    target.width = width
    target.height = height
    context.imageSmoothingEnabled = false
    function draw(time: number) {
      if (!active) return
      const current = textureFrame(source, paused ? freezeTime : time)
      const columns = source.width / width,
        x = (current.index % columns) * width,
        y = Math.floor(current.index / columns) * height
      context.clearRect(0, 0, width, height)
      context.drawImage(image, x, y, width, height, 0, 0, width, height)
      target.dataset.frame = String(current.index)
      if (source.animation && !paused) frame = requestAnimationFrame(draw)
    }
    image.src = source.url
    void image
      .decode()
      .then(() => draw(performance.now()))
      .catch(() => {
        target.dataset.error = 'Texture image could not load'
      })
    return () => {
      active = false
      cancelAnimationFrame(frame)
    }
  }, [source, paused, freezeTime])
  return (
    <canvas
      ref={canvas}
      aria-label={label}
      style={clipPath ? { clipPath } : undefined}
    />
  )
}
