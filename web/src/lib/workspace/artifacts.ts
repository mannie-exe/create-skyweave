import {
  artifactSchema,
  snapshotArtifactSchema,
  resultReferenceSchema,
  assertJson,
} from './contracts.ts'

/** Preview JSON is fetched through its scoped reference, never an arbitrary URL. */
export async function readJSONArtifact(
  value: unknown,
  maximum = 8 * 1024 * 1024,
) {
  const live = artifactSchema.safeParse(value)
  const artifact = live.success
    ? live.data
    : snapshotArtifactSchema.parse(value)
  const expected = `/__atlas/workspaces/${artifact.scope.workspaceId}/packs/${artifact.scope.packId}/artifacts/${artifact.id}`
  const snapshot = `/workspace-snapshot/${artifact.scope.workspaceId}/${artifact.scope.packId}/assets/${artifact.id}-${artifact.sha256}.json`
  if (
    (artifact.url !== expected && artifact.url !== snapshot) ||
    artifact.mediaType !== 'application/json' ||
    artifact.byteLength > maximum
  )
    throw new Error('Unsupported or oversized preview artifact')
  return readCheckedJSON(artifact, maximum)
}

export async function readResultReference(value: unknown) {
  const reference = resultReferenceSchema.parse(value)
  if (
    reference.url !==
    `/__atlas/workspaces/${reference.scope.workspaceId}/packs/${reference.scope.packId}/results/${reference.id}`
  )
    throw new Error('Invalid workspace result reference')
  return readCheckedJSON(reference, 16 * 1024 * 1024)
}

async function readCheckedJSON(
  artifact: { url: string; byteLength: number; sha256: string },
  maximum: number,
) {
  const response = await fetch(artifact.url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  if (
    !response.ok ||
    response.headers.get('content-type')?.split(';')[0] !== 'application/json'
  )
    throw new Error('Preview artifact is unavailable')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Preview artifact has no body')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { value: chunk, done } = await reader.read()
      if (done) break
      length += chunk.byteLength
      if (length > maximum || length > artifact.byteLength)
        throw new Error('Preview artifact exceeds its declared size')
      chunks.push(chunk)
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
  if (length !== artifact.byteLength)
    throw new Error('Preview artifact is incomplete')
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  if (
    Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    ) !== artifact.sha256
  )
    throw new Error('Preview artifact checksum differs')
  const data = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  )
  assertJson(data, maximum)
  return data
}
