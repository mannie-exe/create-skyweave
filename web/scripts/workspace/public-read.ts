import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createArtifactStore } from './artifacts.ts'
import { openPolicy } from './policy.ts'
import type { Registration } from './service.ts'
import type { PublicNamespace } from './static.ts'

/** Server-rendered open content uses admitted projections, not raw public-file caches. */
async function publicArtifacts<T>(
  registration: Registration,
  read: (
    store: ReturnType<typeof createArtifactStore>,
    actor: {
      principal: { kind: 'anonymous'; id: string }
      connectionId: string
    },
  ) => Promise<T>,
) {
  const store = createArtifactStore({
      root: path.join(registration.web, '.cache/workspace/artifacts'),
      registrations: [registration],
      can: async (context, grant) =>
        (await openPolicy.decide(context, grant.action, grant.target)).allowed,
    }),
    actor = {
      principal: { kind: 'anonymous' as const, id: 'open-page' },
      connectionId: randomUUID(),
    }
  try {
    return await read(store, actor)
  } finally {
    await store.dispose()
  }
}
export function publicProjectionHeads(
  registration: Registration,
  namespaces: PublicNamespace[],
) {
  return publicArtifacts(registration, async (store, actor) => {
    const heads: Record<string, string | null> = {}
    for (const namespace of namespaces)
      heads[namespace] =
        (await store.active(actor, registration.scope, namespace, ''))?.id ??
        null
    return heads
  })
}
export function publicProjectionJSON(
  registration: Registration,
  namespace: PublicNamespace,
  name: string,
) {
  return publicArtifacts(registration, async (store, actor) => {
    const generation = await store.active(
        actor,
        registration.scope,
        namespace,
        name,
      ),
      reference = generation?.files[name]
    if (!generation || !reference) return undefined
    if (
      reference.mediaType !== 'application/json' ||
      reference.byteLength > 8 * 1024 * 1024
    )
      throw new Error('Unsupported page projection')
    return store.withGeneration(
      actor,
      registration.scope,
      namespace,
      generation.id,
      async () => {
        const resolved = await store.resolve(
          actor,
          registration.scope,
          reference.id,
        )
        return JSON.parse(await fs.readFile(resolved.file, 'utf8'))
      },
    )
  })
}
