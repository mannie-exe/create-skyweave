import { test, expect } from '@playwright/test'

test('notices have independent lifetimes, bounded history and persistent errors', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/resourcepacks')
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
  let offline = false
  const result = {
    id: 'saved',
    label: 'Save journal source',
    href: '/authoring',
    state: 'succeeded',
    message: 'Source saved',
    startedAt: new Date().toISOString(),
  }
  await page.route('**/__atlas/jobs', (route) =>
    offline
      ? route.abort()
      : route.fulfill({
          json: {
            operations: { session: 'server', current: null, history: [result] },
          },
        }),
  )
  await page.goto('/resourcepacks')
  await page.locator('#job-summary').click()
  await expect(page.locator('.activity-panel')).toContainText('Source saved')
  await expect(page.locator('.toast')).toHaveCount(0)
  offline = true
  await expect(page.locator('#job-summary')).toContainText('disconnected')
  await expect(page.locator('.activity-panel')).toContainText('Source saved')
  offline = false
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click()
  await expect(page.locator('#job-summary')).not.toContainText('disconnected')
  await expect(page.locator('.toast')).toHaveCount(0)
})

test('adopted authoring panel shows live actions and cancellation without a second host', async ({
  page,
}) => {
  let cancelled = false
  await page.route('**/__atlas/jobs', (route) =>
    route.fulfill({
      json: {
        operations: {
          session: 'adoption',
          history: [],
          current: cancelled
            ? null
            : {
                id: 'operation',
                label: 'Check config files',
                state: 'running',
                message: '',
                href: '/authoring',
                startedAt: new Date().toISOString(),
                job: {
                  id: 'job',
                  name: 'config.audit',
                  state: 'running',
                  cancellable: true,
                  diagnostic: '<unsafe>Literal diagnostics</unsafe>',
                },
              },
        },
      },
    }),
  )
  await page.route('**/__atlas/jobs/cancel', (route) => {
    expect(route.request().postDataJSON()).toEqual({ id: 'job' })
    cancelled = true
    return route.fulfill({ json: {} })
  })
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
  await expect(panel).toContainText('No recent operations')
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
