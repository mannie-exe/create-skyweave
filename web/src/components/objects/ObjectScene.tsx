import { useEffect, useRef, useState } from 'react'
import { ModelPreview } from '../../lib/model-preview'
import type { ObjectScene as Scene } from '../../lib/object-resources'
import Button from '../ui/Button'
import Feedback from '../ui/Feedback'
import TextureFrame from './TextureFrame'
import PreviewProgress from '../ui/PreviewProgress'

type Props = {
  context: string
  cameras: Map<string, ReturnType<ModelPreview['cameraState']>>
  left?: Scene
  right?: Scene
  loading: boolean
  mode: 'models' | 'textures'
  leftLabel: string
  rightLabel: string
  single?: boolean
}
export default function ObjectScene({
  context,
  cameras,
  left,
  right,
  loading,
  mode,
  leftLabel,
  rightLabel,
  single = false,
}: Props) {
  const a = useRef<HTMLCanvasElement>(null),
    b = useRef<HTMLCanvasElement>(null)
  const viewers = useRef<ModelPreview[]>([])
  const fitted = useRef(''),
    contextRef = useRef(context)
  contextRef.current = context
  const freezeTime = useRef(0)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState(''),
    [split, setSplit] = useState(50),
    [comparison, setComparison] = useState<'swipe' | 'vertical' | 'horizontal'>(
      'swipe',
    ),
    [paused, setPaused] = useState(false)
  useEffect(() => {
    try {
      const instances = [
        new ModelPreview(a.current!),
        new ModelPreview(b.current!),
      ]
      viewers.current = instances
      let synchronizing = false
      instances.forEach((viewer, index) =>
        viewer.onCameraChange(() => {
          if (synchronizing) return
          synchronizing = true
          cameras.set(contextRef.current, viewer.cameraState())
          instances[1 - index].setCamera(viewer.cameraState())
          synchronizing = false
        }),
      )
      return () => {
        instances.forEach((viewer) => viewer.dispose())
        viewers.current = []
      }
    } catch (reason) {
      setError(String(reason))
    }
  }, [])
  useEffect(() => {
    let active = true
    const [first, second] = viewers.current
    if (!first || (!left && !right)) {
      setRendering(false)
      return
    }
    setError('')
    setRendering(true)
    Promise.all([
      left ? first.show(left.preview) : Promise.resolve(),
      right ? second.show(right.preview) : Promise.resolve(),
    ])
      .then(() => {
        if (!active) return
        const key = left?.preview.id ?? right!.preview.id
        if (fitted.current === key) return
        fitted.current = key
        const bounds = [
          ...(left ? [first.bounds()] : []),
          ...(right ? [second.bounds()] : []),
        ]
        const saved = cameras.get(context)
        if (saved) {
          first.setCamera(saved)
          second.setCamera(saved)
          return
        }
        first.fit({
          min: [0, 1, 2].map((i) =>
            Math.min(...bounds.map((value) => value.min[i])),
          ),
          max: [0, 1, 2].map((i) =>
            Math.max(...bounds.map((value) => value.max[i])),
          ),
        })
      })
      .catch((reason) => {
        if (active) setError(String(reason))
      })
      .finally(() => {
        if (active) setRendering(false)
      })
    return () => {
      active = false
    }
  }, [left, right])
  useEffect(() => {
    setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  useEffect(() => {
    for (const viewer of viewers.current)
      viewer.textureClock(paused ? freezeTime.current : undefined)
  }, [paused])
  useEffect(() => {
    viewers.current.forEach((viewer, index) =>
      viewer.active(
        mode === 'models' &&
          Boolean(index === 0 ? left : right) &&
          (!single || index === 0),
      ),
    )
  }, [mode, single, Boolean(left), Boolean(right)])
  const plane =
    comparison === 'horizontal'
      ? `inset(50% 0 0 0)`
      : `inset(0 0 0 ${comparison === 'vertical' ? 50 : split}%)`
  const animated =
    Object.values(left?.preview.textures ?? {}).some((texture) =>
      Boolean(texture.animation),
    ) ||
    Object.values(right?.preview.textures ?? {}).some((texture) =>
      Boolean(texture.animation),
    )
  function slots(scene?: Scene) {
    const textures: Record<
      string,
      NonNullable<Scene['preview']['texture']>
    > = {}
    for (const [alias, id] of Object.entries(
      scene?.preview.model.textures ?? {},
    )) {
      if (alias === 'particle') continue
      const key = alias === 'top' ? 'up' : alias === 'bottom' ? 'down' : alias
      const texture = scene?.preview.textures[id]
      if (texture) textures[key] = texture
    }
    if (Object.keys(textures).length > 1 && textures.surface)
      delete textures.surface
    return textures
  }
  const leftTextures = slots(left),
    rightTextures = slots(right)
  const bindings = Array.from(
    new Set([...Object.keys(leftTextures), ...Object.keys(rightTextures)]),
  )
  return (
    <section className="content-stack object-scene">
      <div className="section-heading">
        <span data-text-role="caption">{leftLabel}</span>
        <span data-text-role="caption" hidden={single}>
          {rightLabel}
        </span>
      </div>
      <div
        className="object-comparison preview-surface"
        data-mode={mode}
        aria-busy={loading}
      >
        <canvas
          ref={a}
          aria-label="Comparison A model"
          hidden={mode !== 'models' || !left}
        />
        <canvas
          ref={b}
          aria-label="Comparison B model"
          hidden={mode !== 'models' || !right || single}
          style={{ clipPath: plane }}
        />
        {!left && (
          <div className="object-no-preview" data-side="a">
            A: no supported preview
          </div>
        )}
        {!right && !single && (
          <div className="object-no-preview" data-side="b">
            B: no supported preview
          </div>
        )}
        {mode === 'textures' && (
          <div className="object-texture-grid">
            {bindings.map((id) => {
              const first = leftTextures[id],
                second = rightTextures[id]
              return (
                <figure key={id}>
                  <div className="object-texture-pair">
                    {first && (
                      <TextureFrame
                        source={first}
                        label={`${id}: ${leftLabel}`}
                        paused={paused}
                        freezeTime={freezeTime.current}
                      />
                    )}
                    {second && !single && (
                      <TextureFrame
                        source={second}
                        label={`${id}: ${rightLabel}`}
                        paused={paused}
                        freezeTime={freezeTime.current}
                        clipPath={plane}
                      />
                    )}
                  </div>
                  <figcaption>{id}</figcaption>
                </figure>
              )
            })}
          </div>
        )}
        <PreviewProgress
          active={loading || rendering}
          label="Updating object preview"
        />
      </div>
      {error && <Feedback tone="error">{error}</Feedback>}
      <div className="action-row" role="group" aria-label="Comparison layout">
        {!single &&
          (['swipe', 'vertical', 'horizontal'] as const).map((value) => (
            <Button
              key={value}
              aria-pressed={comparison === value}
              onClick={() => setComparison(value)}
            >
              {value === 'swipe'
                ? 'Slider'
                : value === 'vertical'
                  ? 'Half vertical'
                  : 'Half horizontal'}
            </Button>
          ))}
        {mode === 'models' && (
          <Button onClick={() => viewers.current[0]?.fit()}>Fit</Button>
        )}
        {animated && (
          <Button
            aria-pressed={paused}
            onClick={() => {
              if (!paused) freezeTime.current = performance.now()
              setPaused(!paused)
            }}
          >
            {paused ? 'Play texture' : 'Freeze texture'}
          </Button>
        )}
      </div>
      <input
        hidden={single}
        type="range"
        aria-label="Comparison split"
        min="0"
        max="100"
        value={split}
        disabled={comparison !== 'swipe'}
        onChange={(event) => setSplit(Number(event.target.value))}
      />
    </section>
  )
}
