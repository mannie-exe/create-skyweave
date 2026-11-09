import { test, expect } from '@playwright/test'
import { mockWorkspace, activityOperation } from './workspace-fixture.mjs'

test('notices have independent lifetimes, bounded history and persistent errors', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockWorkspace(
    page,
    async (_frame, { session }) => ({ session, current: null, history: [] }),
    ['activity.read'],
  )
  await page.goto('/resourcepacks')
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await import('/src/lib/workspace/client.ts')
          ).workspaceClient.getSnapshot().connection,
      ),
    )
    .toBe('online')
  await page.clock.install()
  await page.evaluate(async () => {
    const { notify } = await import('/src/lib/activity.ts')
    notify('First notice')
  })
  await page.clock.fastForward(6000)
  await page.evaluate(async () => {
    const { notify } = await import('/src/lib/activity.ts')
    notify('Second notice')
    notify('Persistent failure', { tone: 'error' })
  })
  await page.clock.fastForward(2100)
  await expect(page.locator('.toast')).not.toContainText(['First notice'])
  await expect(
    page.locator('.toast').filter({ hasText: 'Second notice' }),
  ).toBeVisible()
  await page.clock.fastForward(10000)
  await expect(page.locator('.toast')).toHaveCount(1)
  await expect(page.locator('.toast')).toContainText('Persistent failure')
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await page.locator('#job-summary').click()
  await page.getByText('Other messages', { exact: true }).click()
  await expect(page.locator('.activity-panel')).toContainText(
    'Persistent failure',
  )
  expect(errors).toEqual([])
})

test('disconnects retain known results and reconnect without replaying old toasts', async ({
  page,
}) => {
  const result = activityOperation({
    label: 'Save journal source',
    href: '/authoring',
    state: 'succeeded',
    message: 'Source saved',
    startedAt: new Date().toISOString(),
  })
  const fixture = await mockWorkspace(
    page,
    async (_frame, { session }) => ({
      session,
      current: null,
      history: [result],
    }),
    ['activity.read'],
    {
      snapshot: (_topic, session) => ({
        session,
        current: null,
        history: [result],
      }),
    },
  )
  await page.goto('/resourcepacks')
  await page.locator('#job-summary').click()
  await expect(page.locator('.activity-panel')).toContainText('Source saved')
  await expect(page.locator('.toast')).toHaveCount(0)
  await fixture.disconnect()
  await expect(page.locator('#job-summary')).toContainText('disconnected')
  await expect(page.locator('.activity-panel')).toContainText('Source saved')
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click()
  await expect(page.locator('#job-summary')).not.toContainText('disconnected')
  await expect(page.locator('.toast')).toHaveCount(0)
})

test('adopted authoring panel shows live actions and cancellation without a second host', async ({
  page,
}) => {
  let cancelled = false
  const source = await (await page.request.get('/__atlas/authoring')).json()
  const operation = activityOperation({
    label: 'Check config files',
    state: 'running',
    message: '',
    href: '/authoring',
    startedAt: new Date().toISOString(),
    job: {
      id: 'native-job',
      name: 'config.audit',
      state: 'running',
      cancellable: true,
      diagnostic: '<unsafe>Literal diagnostics</unsafe>',
    },
  })
  const fixture = await mockWorkspace(
    page,
    async (frame, { session, artifact }) => {
      if (frame.operation === 'quests.read') return source
      if (frame.operation === 'quests.preview')
        return artifact({ changed: [], removed: [], outputs: 0 })
      if (frame.operation === 'operation.cancel') {
        expect(frame.payload).toEqual({ id: operation.id })
        cancelled = true
        fixture.emit('activity', {
          operation: { ...operation, state: 'cancelled', message: 'Cancelled' },
        })
        return { requested: true }
      }
      return {
        session,
        current: null,
        history: cancelled
          ? [{ ...operation, state: 'cancelled', message: 'Cancelled' }]
          : [],
      }
    },
    ['activity.read', 'operation.cancel'],
    {
      snapshot: (_topic, session) => ({
        session,
        current: operation,
        history: [],
      }),
    },
  )
  await page.goto('/authoring-preview?v=b')
  await expect(page).toHaveURL(/\/authoring$/)
  await page.locator('#job-summary').click()
  const panel = page.getByRole('region', { name: 'Activity', exact: true })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Check config files')
  await expect(page.locator('#job-status')).toHaveCount(0)
  await expect(page.locator('.toast-region')).toHaveCount(1)
  await panel.getByText('Diagnostics', { exact: true }).click()
  await expect(panel.locator('pre')).toHaveText(
    '<unsafe>Literal diagnostics</unsafe>',
  )
  await expect(panel.locator('unsafe')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Cancel job', exact: true }).click()
  await expect(panel).toContainText('Cancelled')
  expect(cancelled).toBe(true)
})

test('Activity docks in roomy editors and overlays narrow or dense views', async ({
  page,
}) => {
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  await page.locator('#job-summary').click()
  const editor = page.locator('.workspace-content')
  const dock = page.locator('#workspace-activity-dock')
  await expect(dock).toBeVisible()
  const editorBox = await editor.boundingBox(),
    dockBox = await dock.boundingBox()
  expect(dockBox.x).toBeGreaterThanOrEqual(editorBox.x + editorBox.width)
  await page.getByRole('button', { name: 'Unpin', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Activity', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Pin', exact: true }).click()
  await expect(dock).toBeVisible()
  await page.getByRole('button', { name: 'Localization', exact: true }).click()
  await expect(dock).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(
    page.getByRole('dialog', { name: 'Activity', exact: true }),
  ).toBeVisible()
  await expect(dock).toBeHidden()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('dialog', { name: 'Activity', exact: true }),
  ).toBeVisible()
  await expect(dock).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.locator('#job-summary')).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/resource-authoring')
  await page.locator('#job-summary').click()
  await expect(
    page.getByRole('dialog', { name: 'Activity', exact: true }),
  ).toBeVisible()
  await expect(dock).toBeHidden()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('#job-summary')).toBeFocused()
})

test('partial outcomes retain committed stages and shortened diagnostics load their full checked record', async ({
  page,
}) => {
  const operation = activityOperation({
    state: 'failed',
    message: 'Generation failed',
    stages: [{ name: 'authoring', committed: true }],
    stageCount: 1,
    job: {
      id: 'worker',
      name: 'fixture.generate',
      state: 'failed',
      cancellable: false,
      diagnostic: 'Short diagnostic',
      diagnosticTruncated: true,
    },
  })
  const full = {
    ...operation,
    inputs: {},
    job: {
      ...operation.job,
      diagnostic: '<img src=x onerror=alert(1)>Complete diagnostic',
    },
  }
  await mockWorkspace(
    page,
    async (frame) => {
      expect(frame.operation).toBe('operation.read')
      expect(frame.payload).toEqual({ id: operation.id })
      return full
    },
    ['activity.read'],
    {
      snapshot: (_topic, session) => ({
        session,
        current: null,
        history: [operation],
      }),
    },
  )
  await page.goto('/resourcepacks')
  await page.locator('#job-summary').click()
  const panel = page.locator('.activity-panel')
  await expect(panel).toContainText('Some changes were saved')
  await panel.getByText('Saved stages', { exact: true }).click()
  await expect(panel).toContainText('authoring')
  await panel.getByText('Diagnostics', { exact: true }).click()
  await expect(panel.locator('pre')).toHaveText('Short diagnostic')
  await panel
    .getByRole('button', { name: 'Load full details', exact: true })
    .click()
  await expect(panel.locator('pre')).toHaveText(full.job.diagnostic)
  await expect(panel.locator('pre img')).toHaveCount(0)
  await expect(
    panel.getByText('Diagnostics shortened for Activity.'),
  ).toHaveCount(0)
})

test('recovery shows preserved backups and explicitly cleans only eligible interrupted files', async ({
  page,
}) => {
  const source = {
    id: 'a'.repeat(64),
    kind: 'source-transaction',
    state: 'needs-review',
    label: '<unsafe>Saved sources</unsafe>',
    canClean: false,
    sources: ['map:recipes'],
  }
  const process = {
    id: 'b'.repeat(64),
    kind: 'process',
    state: 'interrupted',
    label: 'objects.export',
    canClean: true,
    sources: [],
  }
  let entries = [source, process],
    reads = 0,
    cleans = 0,
    denied = false
  await mockWorkspace(
    page,
    async (frame) => {
      if (frame.operation === 'recovery.read') {
        reads++
        if (denied)
          throw Object.assign(new Error('Recovery is unavailable'), {
            code: 'NOT_FOUND',
          })
        return {
          entries,
          revision: (cleans ? 'd' : 'c').repeat(64),
          truncated: false,
        }
      }
      expect(frame.operation).toBe('recovery.cleanup')
      expect(frame.payload).toEqual({ revision: 'c'.repeat(64) })
      cleans++
      entries = [source]
      return { removed: 1 }
    },
    ['activity.read', 'recovery.read', 'recovery.cleanup'],
  )
  await page.goto('/resourcepacks')
  await expect(page.locator('#job-summary')).toContainText('attention')
  await page.locator('#job-summary').click()
  const panel = page.locator('.activity-panel')
  await panel.getByText('Recovery · 2', { exact: true }).click()
  await expect(panel).toContainText(source.label)
  expect(await panel.locator('unsafe').count()).toBe(0)
  await expect(panel).toContainText('map:recipes')
  await panel
    .getByRole('button', { name: 'Clean interrupted files', exact: true })
    .click()
  await expect(panel).not.toContainText('objects.export')
  await expect(panel).toContainText(source.label)
  await expect(
    panel.getByRole('button', { name: 'Clean interrupted files', exact: true }),
  ).toBeDisabled()
  expect(cleans).toBe(1)
  expect(reads).toBe(2)
  denied = true
  await panel
    .getByRole('button', { name: 'Refresh recovery', exact: true })
    .click()
  await expect(panel).not.toContainText(source.label)
  await expect(panel).toContainText('Recovery is unavailable')
  expect(cleans).toBe(1)
})
