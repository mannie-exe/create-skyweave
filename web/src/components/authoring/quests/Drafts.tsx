import { createContext, useContext } from 'react'
export const DraftContext = createContext<{
  drafts: Record<string, string>
  setDraft: (id: string, text: string | undefined) => void
}>({ drafts: {}, setDraft: () => {} })
export const useDrafts = () => useContext(DraftContext)
