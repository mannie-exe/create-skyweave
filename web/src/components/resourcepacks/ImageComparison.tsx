import { useId, useState, type CSSProperties, type PointerEvent } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'

type Image = { url: string; label: string }
type Mode = 'swipe' | 'vertical' | 'horizontal'
const modes: { id: Mode; label: string }[] = [
  { id: 'swipe', label: 'Swipe' },
  { id: 'vertical', label: 'Vertical halves' },
  { id: 'horizontal', label: 'Horizontal halves' },
]

/** Reveal aligned, full-size images without squeezing either half to fit. */
export default function ImageComparison({
  before,
  after,
  description,
}: {
  before: Image
  after: Image
  description: string
}) {
  const id = useId()
  const [mode, setMode] = useState<Mode>('swipe')
  const [position, setPosition] = useState(50)
  const [loaded, setLoaded] = useState({ before: '', after: '' })
  const [failed, setFailed] = useState('')
  const reveal = mode === 'swipe' ? position : 50
  const ready = loaded.before === before.url && loaded.after === after.url
  const error = failed === before.url || failed === after.url
  function move(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    setPosition(
      Math.round(
        Math.max(
          0,
          Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
        ),
      ),
    )
  }
  return (
    <figure className="image-comparison content-stack" data-space="control">
      <div className="control-row">
        <div
          className="action-row image-comparison-modes"
          role="group"
          aria-label="Comparison view"
        >
          {modes.map((item) => (
            <Button
              key={item.id}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Field id={id} label="Reveal position" layout="inline">
          {(attributes) => (
            <input
              {...attributes}
              type="range"
              min={0}
              max={100}
              step={1}
              value={reveal}
              disabled={mode !== 'swipe'}
              aria-valuetext={`${reveal}% ${before.label}, ${100 - reveal}% ${after.label}`}
              onChange={(event) => setPosition(Number(event.target.value))}
            />
          )}
        </Field>
      </div>
      <div
        className="image-comparison-canvas"
        data-mode={mode}
        data-ready={ready}
        style={{ '--comparison-reveal': `${reveal}%` } as CSSProperties}
        onPointerDown={(event) => {
          if (
            mode !== 'swipe' ||
            !ready ||
            event.button !== 0 ||
            !event.isPrimary
          )
            return
          event.currentTarget.setPointerCapture(event.pointerId)
          move(event)
        }}
        onPointerMove={(event) => {
          if (
            mode === 'swipe' &&
            event.currentTarget.hasPointerCapture(event.pointerId)
          )
            move(event)
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
        }}
      >
        <img
          key={before.url}
          className="image-comparison-before"
          src={before.url}
          alt={`${before.label}. ${description}`}
          width={2880}
          height={1856}
          draggable={false}
          onLoad={() =>
            setLoaded((current) => ({ ...current, before: before.url }))
          }
          onError={() => setFailed(before.url)}
        />
        <div className="image-comparison-overlay">
          <img
            key={after.url}
            src={after.url}
            alt={`${after.label}. ${description}`}
            width={2880}
            height={1856}
            draggable={false}
            onLoad={() =>
              setLoaded((current) => ({ ...current, after: after.url }))
            }
            onError={() => setFailed(after.url)}
          />
        </div>
        {ready && (
          <span className="image-comparison-divider" aria-hidden="true">
            {mode === 'swipe' && (
              <span className="image-comparison-grip">Drag</span>
            )}
          </span>
        )}
        {!ready && (
          <span className="image-comparison-loading" role="status">
            {error
              ? 'Capture unavailable. Try the original links.'
              : 'Loading captures…'}
          </span>
        )}
      </div>
      <figcaption className="action-row" data-text-role="caption">
        <a href={before.url} target="_blank" rel="noreferrer">
          Open original · {before.label}
        </a>
        <a href={after.url} target="_blank" rel="noreferrer">
          Open original · {after.label}
        </a>
      </figcaption>
    </figure>
  )
}
