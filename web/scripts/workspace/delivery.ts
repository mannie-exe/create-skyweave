import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from './policy.ts'
import type { Scope } from '../../src/lib/workspace/contracts.ts'
import type { createArtifactStore } from './artifacts.ts'

const projectionPath =
  /^\/generated\/((?:(?:texture-resources|objects)\/[a-zA-Z0-9_/-]+\.(?:json|png)|icons\/[a-f0-9]+\.(?:png|svg)|(?:catalog|domains|routes|coverage|recipes|loot|world|structures|islands|authored|details\/[a-z0-9_\/-]+)\.json))$/
// These reviewed captures are explicitly open static evidence, not workspace projections.
const evidencePath =
  /^\/generated\/(?:resource-review|design-preview)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|mp4|webm)$/

/** Stable open-local aliases resolve only admitted generations, never public-file fallback. */
export async function projectionAlias(
  artifacts: ReturnType<typeof createArtifactStore>,
  context: Context,
  scope: Scope,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const pathname = request.url?.split('?')[0] ?? ''
  if (!pathname.startsWith('/generated/')) return false
  if (
    evidencePath.test(pathname) &&
    ['GET', 'HEAD'].includes(request.method ?? '')
  )
    return false
  const match = projectionPath.exec(pathname)
  if (!match || !['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(404).end()
    return true
  }
  try {
    const namespace = match[1].startsWith('texture-resources/')
      ? 'texture-resources'
      : match[1].startsWith('objects/')
        ? 'objects'
        : 'map'
    const name =
      namespace === 'map' ? match[1] : match[1].slice(namespace.length + 1)
    const generation = await artifacts.active(context, scope, namespace, name),
      reference = generation?.files[name]
    if (!reference) {
      response.writeHead(404).end()
      return true
    }
    const previous = request.url
    request.url = reference.url
    try {
      return await artifacts.http(context, request, response)
    } finally {
      request.url = previous
    }
  } catch {
    if (!response.headersSent) response.writeHead(404).end()
    else response.destroy()
    return true
  }
}
