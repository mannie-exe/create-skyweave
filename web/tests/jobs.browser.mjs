import { test, expect } from '@playwright/test'

test('real named audit keeps source queries pure and records its authoritative operation', async ({
  page,
}) => {
  await page.goto('/resourcepacks', { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async () => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    const { readJSONArtifact } = await import('/src/lib/workspace/artifacts.ts')
    const [models, map] = await Promise.all([
      workspaceClient.query('models.read', {}),
      workspaceClient.query('map.sources.read', {}),
    ])
    const reference = await workspaceClient.command('config.audit', {})
    const audit = await readJSONArtifact(reference)
    const activity = await workspaceClient.query('activity.read', {})
    await workspaceClient.query('journal.read', {})
    const after = await workspaceClient.query('activity.read', {})
    let invalid
    try {
      await workspaceClient.command('operation.cancel', {
        id: crypto.randomUUID(),
        command: 'sh',
      })
    } catch (error) {
      invalid = error.failure?.code
    }
    return {
      modelSource: !!models.document,
      mapSources: Object.keys(map.files).length,
      records: audit.records.length,
      current: activity.current,
      last: activity.history[0],
      after: after.history[0],
      invalid,
    }
  })
  expect(result.modelSource).toBe(true)
  expect(result.mapSources).toBe(8)
  expect(result.records).toBeGreaterThan(0)
  expect(result.current).toBeNull()
  expect(result.last.name).toBe('config.audit')
  expect(result.last.state).toBe('succeeded')
  expect(result.last.label).toBe('Check config files')
  expect(result.after.id).toBe(result.last.id)
  expect(result.invalid).toBe('INVALID_INPUT')
})
