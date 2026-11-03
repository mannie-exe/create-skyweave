import { workspaceClient } from './client'
import type { Topic } from './contracts'

type Change = { topic: 'sources' | 'projections'; ids: string[] }
type Entry = {
  id?: string
  revision?: string
  namespace?: string
  generationId?: string
}
/** Revision subscriptions shared by React and DOM editors; they never dispatch jobs. */
export function observeWorkspaceChanges(options: {
  sources?: (id: string) => boolean
  projections?: string[]
  changed: (change: Change) => void
}) {
  const previous = new Map<Topic, Map<string, string>>()
  const seenEvents = new Map<Topic, unknown>()
  const own = new Map<Topic, Map<string, string | null>>()
  const read = () => {
    const state = workspaceClient.getSnapshot()
    for (const topic of ['sources', 'projections'] as const) {
      const current = state.topics[topic]
      if (!current) continue
      const event = current.event as
        | {
            commandId?: string
            revisions?: Record<string, string | null>
            namespace?: string
            generationId?: string
          }
        | undefined
      if (event && seenEvents.get(topic) !== event) {
        seenEvents.set(topic, event)
        if (
          event.commandId &&
          state.commands.some(
            (command) => command.commandId === event.commandId,
          )
        ) {
          const revisions = own.get(topic) ?? new Map()
          for (const [id, revision] of Object.entries(event.revisions ?? {}))
            revisions.set(id, revision)
          if (event.namespace && event.generationId)
            revisions.set(event.namespace, event.generationId)
          own.set(topic, revisions)
        }
      }
      if (current.stale) continue
      const snapshot = current.snapshot as { entries?: Entry[] } | undefined
      if (!Array.isArray(snapshot?.entries)) continue
      const entries = new Map<string, string>()
      for (const entry of snapshot.entries) {
        const id = topic === 'sources' ? entry.id : entry.namespace
        const revision =
          topic === 'sources' ? entry.revision : entry.generationId
        if (id && revision) entries.set(id, revision)
      }
      const before = previous.get(topic)
      previous.set(topic, entries)
      const acknowledgements = own.get(topic)
      if (before) {
        const ids = [...new Set([...before.keys(), ...entries.keys()])].filter(
          (id) =>
            before.get(id) !== entries.get(id) &&
            (!acknowledgements?.has(id) ||
              acknowledgements.get(id) !== (entries.get(id) ?? null)) &&
            (topic === 'sources'
              ? options.sources?.(id)
              : options.projections?.includes(id)),
        )
        if (ids.length) options.changed({ topic, ids })
      }
      own.delete(topic)
    }
  }
  const off = workspaceClient.subscribe(read)
  read()
  return off
}
