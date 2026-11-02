import '../../styles/preview-surface.css'
export default function PreviewProgress({
  active,
  label,
}: {
  active: boolean
  label: string
}) {
  return (
    <span className="preview-progress" role="status" hidden={!active}>
      <span className="preview-spinner" aria-hidden="true" />
      <span className="preview-progress-label">{label}</span>
    </span>
  )
}
