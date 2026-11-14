import { selectSource } from './object-workbench.mjs'
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { recordWorkspaceWrites } from './workspace-fixture.mjs'

const recipes = JSON.parse(
  readFileSync(new URL('../../authoring/model-recipes.json', import.meta.url)),
).recipes

test('model workbench previews extrusion and fitting without saving', async ({
  page,
}) => {
  const errors = []
  const writes = []
  recordWorkspaceWrites(page, writes)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/model-authoring')
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  await expect(page.locator('#model-list button')).toHaveCount(recipes.length)
  await expect(page.locator('#model-canvas')).toHaveAttribute(
    'data-ready',
    'industrial-bars-post',
  )
  await page.getByLabel('Depth', { exact: true }).fill('1.5')
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await expect(page.locator('#models-save')).toBeEnabled()
  await expect(page.locator('#models-generate')).toBeDisabled()
  await selectSource(page, 'models', 'industrial-bars-side')
  // Exercise the supported fitting editor without shipping a fixture recipe.
  const fitting = {
    id: 'industrial-bars-side',
    label: 'Lantern fitting fixture',
    kind: 'fitting',
    enabled: true,
    output: 'create_skyweave:block/fitting_fixture',
    texture: { source: 'minecraft', id: 'minecraft:block/lantern' },
    texture_bindings: {
      lantern: { source: 'minecraft', id: 'minecraft:block/lantern' },
    },
    model: { source: 'minecraft', id: 'minecraft:block/template_lantern' },
    edits: [{ element: 0, name: '', faces: { north: { uv: [0, 0, 8, 8] } } }],
  }
  await page.locator('summary').filter({ hasText: 'Recipe JSON' }).click()
  await page.locator('#model-json').fill(JSON.stringify(fitting))
  await page.locator('#model-apply-json').click()
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await expect(page.locator('#model-canvas')).toHaveAttribute(
    'data-ready',
    'industrial-bars-side',
  )
  await page
    .getByRole('combobox', { name: 'Element', exact: true })
    .selectOption('0')
  await page
    .getByRole('combobox', { name: 'Face', exact: true })
    .selectOption('north')
  await page.getByLabel('U start', { exact: true }).fill('2')
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  const recipe = JSON.parse(await page.locator('#model-json').inputValue())
  const element = recipe.edits.find((edit) => edit.element === 0)
  expect(element.faces.north.uv[0]).toBe(2)
  await selectSource(page, 'models', 'industrial-bars-post')
  await expect(page.getByLabel('Depth', { exact: true })).toHaveValue('1.5')
  const hostileLabel = 'Fixture <img src=x onerror="window.atlasInjected=1">'
  await page.locator('#model-label').fill(hostileLabel)
  await expect(page.locator('#model-list')).toContainText(hostileLabel)
  await expect(page.locator('#model-list img[src="x"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.atlasInjected)).toBeUndefined()
  expect(errors).toEqual([])
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('#models-reload').click()
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  await expect(page.getByLabel('Depth', { exact: true })).toHaveValue('2')
  expect(writes).toEqual([])
})

test('mobile model workbench fits viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  await page.goto('/model-authoring')
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('unapplied JSON survives recipe switches and cannot be silently generated', async ({
  page,
}) => {
  await page.goto('/model-authoring')
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  await page.locator('summary').filter({ hasText: 'Recipe JSON' }).click()
  await page.locator('#model-json').fill('{unfinished')
  await selectSource(page, 'models', 'industrial-bars-side')
  await selectSource(page, 'models', 'industrial-bars-post')
  await expect(page.locator('#model-json')).toHaveValue('{unfinished')
  await expect(page.locator('#models-generate')).toBeDisabled()
  await page.locator('#model-apply-json').click()
  await expect(page.locator('#model-json')).toHaveValue('{unfinished')
  await expect(page.locator('#models-status')).not.toHaveText('Source loaded')
})
