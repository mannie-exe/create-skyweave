import { workspaceClient } from './workspace/client.ts'
import { readJSONArtifact } from './workspace/artifacts.ts'

export async function requestJSON(url: string, body?: unknown) {
  if (url === '/__atlas/status' && body === undefined)
    return workspaceClient.command('snapshot.check', {})
  if (url === '/__atlas/refresh' && body !== undefined)
    return workspaceClient.command('snapshot.refresh', body)
  const objectOperation =
    /^\/__atlas\/objects\/(inputs|export|generate|preview)$/.exec(url)
  if (objectOperation && body !== undefined) {
    const result = await workspaceClient.command(
      'objects.' + objectOperation[1],
      body,
    )
    return objectOperation[1] === 'preview'
      ? readJSONArtifact(result.artifact)
      : result
  }
  if (url === '/__atlas/textures/generate' && body !== undefined)
    return workspaceClient.command('textures.generate', body)
  if (url === '/__atlas/resource-reviews' && body === undefined)
    return workspaceClient.query('reviews.read', {})
  if (url === '/__atlas/resource-reviews/save' && body !== undefined)
    return workspaceClient.command('reviews.save', body)
  if (url === '/__atlas/export' && body !== undefined)
    return workspaceClient.command('scenario.export', body)
  if (url === '/__atlas/workspace' && body === undefined)
    return workspaceClient.query('map.sources.read', {})
  if (url === '/__atlas/models' && body === undefined) {
    const saved = await workspaceClient.query('models.read', {})
    const artifact =
      saved.preview.state === 'current'
        ? saved.preview.artifact
        : await workspaceClient.command('models.preview', {
            document: saved.document,
          })
    return { ...saved, ...(await readJSONArtifact(artifact)) }
  }
  if (url === '/__atlas/models/preview' && body !== undefined)
    return readJSONArtifact(
      await workspaceClient.command('models.preview', body),
    )
  if (url === '/__atlas/models/save' && body !== undefined)
    return workspaceClient.command('models.save', body)
  if (url === '/__atlas/models/generate' && body !== undefined)
    return workspaceClient.command('resources.generate', body)
  if (url === '/__atlas/authoring' && body === undefined) {
    const saved = await workspaceClient.query('quests.read', {})
    try {
      const artifact =
        saved.preview.state === 'current'
          ? saved.preview.artifact
          : await workspaceClient.command('quests.preview', {
              revision: saved.revision,
            })
      return { ...saved, generation: await readJSONArtifact(artifact) }
    } catch (error) {
      return {
        ...saved,
        generationError:
          error instanceof Error
            ? error.message
            : 'Quest review is unavailable',
      }
    }
  }
  if (url === '/__atlas/authoring/audit' && body === undefined)
    return readJSONArtifact(await workspaceClient.command('config.audit', {}))
  if (url === '/__atlas/authoring/generate' && body !== undefined)
    return workspaceClient.command('quests.generate', body)
  if (url === '/__atlas/authoring/save' && body !== undefined) {
    const input = body as { changes?: Record<string, unknown>; name?: string }
    const names = input.changes
      ? Object.keys(input.changes)
      : [input.name ?? '']
    return workspaceClient.command(
      names.length && names.every((name) => name.startsWith('quests/'))
        ? 'quests.save'
        : 'config.source.save',
      body,
    )
  }
  const response = await fetch(url, {
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
  let value
  try {
    value = await response.json()
  } catch {
    throw new Error(
      url.startsWith('/__atlas/')
        ? 'Local editing requires pnpm dev and a configured pack directory.'
        : `${url}: expected JSON (HTTP ${response.status})`,
    )
  }
  if (!response.ok)
    throw new Error(value?.error || `${url}: ${response.status}`)
  return value
}
