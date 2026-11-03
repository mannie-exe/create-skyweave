import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  assertJson,
  resultReferenceSchema,
  type Scope,
  type ResultReference,
} from '../../src/lib/workspace/contracts.ts'
import type { Context, Grant } from './policy.ts'
import { scopeKey, target } from './policy.ts'
import type { Delivery } from './service.ts'
import { hash } from './identity.ts'
import { WorkspaceError } from './errors.ts'

/** Short-lived JSON replies, separate from durable generated artifacts and source writes. */
export function createResultDelivery(options: {
  can: (context: Context, grant: Grant) => Promise<boolean>
  now?: () => number
  maxBytes?: number
  maxEntries?: number
  ttlMs?: number
}) {
  const now = options.now ?? Date.now
  const records = new Map<
    string,
    {
      scope: Scope
      bytes: Buffer
      expires: number
      authorize: Delivery['authorize']
    }
  >()
  let byteLength = 0
  let closed = false
  function prune() {
    for (const [id, record] of records)
      if (record.expires <= now()) {
        byteLength -= record.bytes.byteLength
        records.delete(id)
      }
  }
  async function publish(
    context: Context,
    scope: Scope,
    delivery: Delivery,
  ): Promise<ResultReference> {
    await delivery.authorize(context)
    assertJson(delivery.payload, 16 * 1024 * 1024)
    const bytes = Buffer.from(JSON.stringify(delivery.payload))
    const id = randomUUID()
    const reference = resultReferenceSchema.parse({
      id,
      scope,
      byteLength: bytes.byteLength,
      sha256: hash(bytes),
      url: `/__atlas/workspaces/${scope.workspaceId}/packs/${scope.packId}/results/${id}`,
    })
    if (
      !(await options.can(context, {
        action: 'artifact.read',
        target: target(scope, 'artifact', 'result:' + id),
      }))
    )
      throw new WorkspaceError('NOT_FOUND', 'Reply is unavailable')
    if (closed)
      throw new WorkspaceError(
        'STORAGE_UNAVAILABLE',
        'Workspace stopped',
        'reconnect',
      )
    prune()
    // Capacity admission and insertion share one synchronous section after authorization.
    if (
      records.size >= (options.maxEntries ?? 128) ||
      byteLength + bytes.byteLength > (options.maxBytes ?? 64 * 1024 * 1024)
    )
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'Reply storage is full; retry after current replies expire.',
        'after-idle',
      )
    records.set(id, {
      scope: reference.scope,
      bytes,
      expires: now() + (options.ttlMs ?? 5 * 60_000),
      authorize: delivery.authorize,
    })
    byteLength += bytes.byteLength
    return reference
  }
  async function http(
    context: Context,
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    const pathname = request.url?.split('?')[0] ?? ''
    if (
      !pathname.startsWith('/__atlas/workspaces/') ||
      !pathname.includes('/results/')
    )
      return false
    try {
      prune()
      const match =
        /^\/__atlas\/workspaces\/([a-z0-9][a-z0-9_-]{0,63})\/packs\/([a-z0-9][a-z0-9_-]{0,63})\/results\/([a-f0-9-]{36})$/.exec(
          pathname,
        )
      const record = match && records.get(match[3])
      if (
        !match ||
        !record ||
        scopeKey(record.scope) !== `${match[1]}/${match[2]}`
      )
        throw new Error('Unavailable')
      await record.authorize(context)
      if (
        record.expires <= now() ||
        records.get(match[3]) !== record ||
        !(await options.can(context, {
          action: 'artifact.read',
          target: target(record.scope, 'artifact', 'result:' + match[3]),
        }))
      )
        throw new Error('Unavailable')
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end()
        return true
      }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': record.bytes.byteLength,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(request.method === 'HEAD' ? undefined : record.bytes)
    } catch {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end()
    }
    return true
  }
  return {
    publish,
    http,
    dispose() {
      closed = true
      records.clear()
      byteLength = 0
    },
  }
}
