import { selectSource } from './object-workbench.mjs'
import { test, expect } from '@playwright/test'

test('texture catalogue compares approved artwork on native and patch geometry without installing', async ({
  page,
}) => {
  const errors = [],
    failed = [],
    writes = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url())
  })
  page.on('request', (request) => {
    if (/\/__atlas\/models\/(save|generate)$/.test(request.url()))
      writes.push(request.url())
  })
  await page.goto('/resource-authoring?view=textures')
  await expect(page.locator('#texture-list button')).toHaveCount(4)
  for (const [kind, state] of [
    ['barrel', 'Unlooted'],
    ['barrel', 'Looted'],
    ['chest', 'Unlooted'],
    ['chest', 'Looted'],
  ]) {
    await selectSource(page, 'textures', `${kind}-${state.toLowerCase()}`)
    await expect(page.locator('#texture-resource-approval')).toContainText(
      'Approved',
    )
    const checkbox = page.locator('#texture-resource-modpack')
    for (const enabled of [false, true]) {
      await checkbox.setChecked(enabled)
      await expect(
        page.locator('#texture-resource-model-surface'),
      ).toHaveAttribute('aria-busy', 'false')
      await expect(page.locator('#texture-resource-model')).toHaveAttribute(
        'data-ready',
        `${kind}-${state.toLowerCase()}`,
      )
      await expect(page.locator('#texture-resource-model-note')).toContainText(
        enabled ? 'Resource patches' : 'Native',
      )
      await expect(page.locator('.texture-resource-image')).toHaveCount(
        kind === 'barrel' ? 6 : 1,
      )
      await expect
        .poll(() =>
          page
            .locator('.texture-resource-image')
            .evaluateAll((images) =>
              images.every((image) => image.complete && image.naturalWidth > 0),
            ),
        )
        .toBe(true)
      await expect(page.locator('#textures-status')).toContainText(
        `${enabled ? 'Modpack changes' : 'Baseline'} · preview current`,
      )
      await expect(page.locator('#texture-resource-inclusion')).toHaveText(
        'Included in the generated client resource pack.',
      )
    }
  }
  await page.getByLabel('Find object').fill('no such texture')
  await expect(
    page.getByLabel('Resource objects', { exact: true }).getByRole('button'),
  ).toHaveCount(0)
  await page.getByLabel('Find object').fill('')
  await selectSource(page, 'models', 'lootr-barrel-clasps')
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  const label = page.locator('#model-label')
  const original = await label.inputValue()
  await label.fill(`${original} draft`)
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await page.getByRole('button', { name: 'Textures', exact: true }).click()
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await expect(label).toHaveValue(`${original} draft`)
  await page.getByRole('button', { name: 'Textures', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 850 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
  expect(failed).toEqual([])
  expect(writes).toEqual([])
})

test('texture rebuild uses the named job and rejects arbitrary inputs', async ({
  page,
}) => {
  await page.goto('/resource-authoring?view=textures&texture=chest-looted')
  await expect(page.locator('#texture-resource-title')).toHaveText(
    'Lootr chest · Looted',
  )
  await page
    .getByRole('button', { name: 'Rebuild previews', exact: true })
    .click()
  await expect(page.locator('#textures-status')).toHaveText(
    'Modpack changes · preview current',
  )
  const result = await page.evaluate(async () => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    try {
      await workspaceClient.command('textures.generate', {
        path: '/tmp/unwanted',
      })
    } catch (error) {
      return error.failure
    }
  })
  expect(result.code).toBe('INVALID_INPUT')
  expect(result.message).toBe('Invalid operation input')
})

test('unchanged textures have no preview switch', async ({ page }) => {
  const response = await page.request.get(
    '/generated/texture-resources/index.json',
  )
  const data = await response.json()
  data.resources[0].hasTextureChanges = false
  data.resources[0].hasModelChanges = false
  await page.route('**/generated/texture-resources/index.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(data),
    }),
  )
  await page.goto('/resource-authoring?view=textures')
  await expect(page.locator('#texture-resource-title')).toContainText(
    'Lootr barrel',
  )
  await expect(page.locator('#texture-resource-preview-options')).toBeHidden()
  await expect(page.locator('#texture-resource-modpack')).toBeDisabled()
  await expect(page.locator('#textures-status')).toHaveText(
    'Baseline · preview current',
  )
})

test('model recipes toggle built textures per face and keep drafts across related views', async ({
  page,
}) => {
  const errors = [],
    writes = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/\/__atlas\/models\/(save|generate)$/.test(request.url()))
      writes.push(request.url())
  })
  await page.goto('/resource-authoring?view=models&recipe=lootr-barrel-clasps')
  await expect(page.locator('#model-texture')).toHaveAttribute(
    'data-modpack',
    'true',
  )
  const before = await page.locator('#model-json').inputValue()
  const checkbox = page.locator('#model-modpack')
  await expect(checkbox).toBeChecked()
  await page.locator('#model-plane').selectOption('1')
  await expect(page.locator('#model-texture')).toHaveAttribute(
    'data-applied-texture',
    'create_skyweave:generated/lootr/barrel-unlooted/north',
  )
  await checkbox.uncheck()
  await expect(page.locator('#model-texture')).toHaveAttribute(
    'data-applied-texture',
    'lootr:block/barrel_side',
  )
  await expect(page.locator('#model-texture')).toHaveAttribute(
    'data-modpack',
    'false',
  )
  await expect(page.locator('#model-json')).toHaveValue(before)
  await expect(page.locator('#models-save')).toBeDisabled()
  await checkbox.check()
  await expect(page.locator('#model-texture')).toHaveAttribute(
    'data-applied-texture',
    'create_skyweave:generated/lootr/barrel-unlooted/north',
  )
  await page.locator('#model-label').fill('Unsaved material study')
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await page.locator('#model-related-textures a').click()
  await expect(page.locator('#texture-resource-title')).toHaveText(
    'Lootr barrel · Unlooted',
  )
  await expect(page.locator('#texture-resource-related')).toHaveText(
    'Back to model recipe',
  )
  await page.locator('#texture-resource-related').click()
  await expect(page.locator('#model-label')).toHaveValue(
    'Unsaved material study',
  )
  await page.goBack()
  await expect(page.locator('#texture-resource-title')).toBeVisible()
  await page.goForward()
  await expect(page.locator('#model-label')).toHaveValue(
    'Unsaved material study',
  )
  await selectSource(page, 'models', 'industrial-bars-post')
  await expect(page.locator('#model-resource-preview')).toBeHidden()
  expect(errors).toEqual([])
  expect(writes).toEqual([])
})

test('texture entries link only to corresponding authored geometry', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/resource-authoring?view=textures&texture=barrel-looted')
  await expect(page.locator('#texture-resource-related')).toHaveText(
    'View model recipe',
  )
  await page.locator('#texture-resource-related').click()
  await expect(page.locator('#model-label')).toHaveValue(
    'Lootr barrel: looted clasps',
  )
  await expect(page.locator('#model-enabled')).toBeChecked()
  await page.locator('#model-related-textures a').click()
  await expect(page.locator('#texture-resource-title')).toHaveText(
    'Lootr barrel · Looted',
  )
  await selectSource(page, 'textures', 'chest-looted')
  await expect(page.locator('#texture-resource-related')).toBeHidden()
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await expect(page.locator('#model-list')).not.toContainText('Built model')
  await page.setViewportSize({ width: 390, height: 850 })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
  expect(errors).toEqual([])
})
