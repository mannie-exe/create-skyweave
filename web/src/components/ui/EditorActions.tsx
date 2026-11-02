import type { ReactNode } from 'react'

export default function EditorActions({
  children,
  status,
}: {
  children: ReactNode
  status: ReactNode
}) {
  return (
    <div className="editor-actions content-stack" data-space="control">
      <div className="action-row" aria-label="Current view actions">
        {children}
      </div>
      <div className="editor-status content-stack" data-space="control">
        {status}
      </div>
    </div>
  )
}
