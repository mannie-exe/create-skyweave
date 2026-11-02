import { selectSource } from './object-workbench.mjs'
import { test, expect } from '@playwright/test'

async function open(page, layout = 'inline') {
  await page.goto(`/model-authoring?recipe=lootr-barrel-clasps`)
  await expect(page.locator('#model-canvas')).toHaveAttribute(
    'data-ready',
    'lootr-barrel-clasps',
  )
  await expect(page.locator('#model-texture')).toHaveAttribute(
    'data-source',
    'lootr:block/barrel_side',
  )
  await expect(page.locator('#mask-status')).toContainText(
    'pixels in last valid mask',
  )
}
async function pixel(page, x, y) {
  const canvas = page.locator('#model-texture')
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  await page.mouse.click(
    bounds.x + ((x + 0.5) / 16) * bounds.width,
    bounds.y + ((y + 0.5) / 16) * bounds.height,
  )
}

test('material tools alter explicit masks and retain drafts without writing source', async ({
  page,
}) => {
  const mutations = [],
    errors = []
  page.on('request', (request) => {
    if (/\/__atlas\/models\/(save|generate)$/.test(request.url()))
      mutations.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await open(page)
  const initialCount = parseInt(await page.locator('#mask-status').innerText())
  const sourceResponse = await page.request.get('/__atlas/models')
  const source = await sourceResponse.json()
  const dataUrl = source.previews.find((p) => p.id === 'lootr-barrel-clasps')
    .texture.url
  const expected = await page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return [...context.getImageData(8, 8, 1, 1).data].slice(0, 3)
  }, dataUrl)
  await pixel(page, 8, 8)
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  let recipe = JSON.parse(await page.locator('#model-json').inputValue())
  expect(recipe.parts[0].mask.palette.at(-1)).toEqual(expected)
  await page.getByLabel('Texture tool', { exact: true }).selectOption('exclude')
  await pixel(page, 0, 3)
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await expect
    .poll(async () => parseInt(await page.locator('#mask-status').innerText()))
    .toBe(initialCount - 1)
  await selectSource(page, 'models', 'industrial-bars-post')
  await selectSource(page, 'models', 'lootr-barrel-clasps')
  await expect(page.locator('.model-previews')).toHaveAttribute(
    'data-mask-layout',
    'inspector',
  )
  recipe = JSON.parse(await page.locator('#model-json').inputValue())
  expect(recipe.parts[0].mask.exclude).toEqual([[0, 3]])
  await expect(page.locator('#models-save')).toBeEnabled()
  await expect(page.locator('#models-generate')).toBeDisabled()
  await page.getByRole('button', { name: 'Clear colors', exact: true }).click()
  await expect(page.locator('#models-status')).toContainText(
    'Material mask contains no selected pixels',
  )
  await expect(page.locator('#model-json')).toHaveValue(/"palette":\s*\[\]/)
  await page.getByLabel('Texture tool', { exact: true }).selectOption('pick')
  await pixel(page, 1, 3)
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  expect(mutations).toEqual([])
  expect(errors).toEqual([])
})

test('mask controls respect unapplied JSON, keyboard selection and narrow layouts', async ({
  page,
}) => {
  await open(page, 'inspector')
  const canvas = page.locator('#model-texture')
  await page.getByLabel('Texture tool', { exact: true }).selectOption('include')
  await canvas.focus()
  await canvas.press('ArrowRight')
  await canvas.press('ArrowDown')
  await canvas.press('Enter')
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  let recipe = JSON.parse(await page.locator('#model-json').inputValue())
  expect(recipe.parts[0].mask.include).toEqual([[1, 1]])
  await page.getByText('Recipe JSON', { exact: true }).click()
  await page.locator('#model-json').fill('{unfinished')
  await expect(
    page.getByRole('button', { name: 'Clear colors', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Texture tool', { exact: true })).toBeDisabled()
  await page
    .getByRole('button', { name: 'Discard JSON edits', exact: true })
    .click()
  recipe = JSON.parse(await page.locator('#model-json').inputValue())
  expect(recipe.parts[0].mask.include).toEqual([[1, 1]])
  await page.setViewportSize({ width: 390, height: 850 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('retired material layout links preserve the selected recipe', async ({
  page,
}) => {
  await page.goto(
    '/model-authoring-preview?layout=inline&recipe=lootr-barrel-material-study',
  )
  await expect(page).toHaveURL(
    /\/resource-authoring\?recipe=lootr-barrel-clasps&view=models/,
  )
  await expect(page.locator('#model-label')).toHaveValue(
    'Lootr barrel: unlooted clasps',
  )
})

test('ordered texture regions update artwork and models without publishing', async ({
  page,
}) => {
  const writes = [],
    errors = []
  page.on('request', (request) => {
    if (/\/__atlas\/models\/(save|generate)$/.test(request.url()))
      writes.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await open(page)
  // Exercise a generic mirror draft independently of the current authored study.
  await page.getByText('Recipe JSON', { exact: true }).click()
  const initialRecipe = JSON.parse(
    await page.locator('#model-json').inputValue(),
  )
  initialRecipe.texture_edits = {
    [initialRecipe.texture.id]: [
      { source: [8, 0, 16, 16], target: [0, 0, 8, 16], flip_u: true },
    ],
  }
  await page.locator('#model-json').fill(JSON.stringify(initialRecipe))
  await page
    .getByRole('button', { name: 'Apply to draft', exact: true })
    .click()
  await expect(page.locator('#texture-operations fieldset')).toHaveCount(1)
  await page.getByText('Recipe JSON', { exact: true }).click()
  const canvas = page.locator('#model-texture')
  await expect(canvas).toHaveAttribute('data-composed', 'true')
  const region = page.locator('#texture-operations fieldset').first()
  await expect(region.getByLabel('Flip U', { exact: true })).toBeChecked()
  await region.getByLabel('Enabled', { exact: true }).uncheck()
  await expect(canvas).toHaveAttribute('data-composed', 'false')
  await region.getByLabel('Enabled', { exact: true }).check()
  await expect(canvas).toHaveAttribute('data-composed', 'true')
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  const sample = async () =>
    page.evaluate(() => {
      const canvas = document.querySelector('#model-texture'),
        context = canvas.getContext('2d')
      return [0, 15].map((x) => [
        ...context.getImageData((x + 0.5) * 32, 7.5 * 32, 1, 1).data,
      ])
    })
  // Hide authored overlays so the comparison reads the actual derived pixels.
  await page.locator('#mask-show-overlay').uncheck()
  await page.locator('#mask-show-grid').uncheck()
  const colors = await sample()
  expect(colors[0]).toEqual(colors[1])
  await page.getByRole('button', { name: 'Add region', exact: true }).click()
  await expect(
    page.locator('#texture-operations .sortable-selection'),
  ).toHaveCount(2)
  await expect(page.locator('#texture-operations fieldset')).toHaveCount(1)
  await page.getByRole('button', { name: 'Move up 2', exact: true }).click()
  let recipe = JSON.parse(await page.locator('#model-json').inputValue())
  expect(recipe.texture_edits[recipe.texture.id][1].flip_u).toBe(true)
  await page
    .getByRole('button', { name: 'Remove region 1', exact: true })
    .click()
  await expect(page.locator('#texture-operations fieldset')).toHaveCount(1)
  await page.getByText('Recipe JSON', { exact: true }).click()
  await page.locator('#model-json').fill('{unfinished')
  await expect(
    page.getByRole('button', { name: 'Add region', exact: true }),
  ).toBeDisabled()
  await expect(region.getByLabel('Flip U', { exact: true })).toBeDisabled()
  await page
    .getByRole('button', { name: 'Discard JSON edits', exact: true })
    .click()
  await page.setViewportSize({ width: 390, height: 850 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(writes).toEqual([])
  expect(errors).toEqual([])
})

test('preview spinners cover queued work and clear after success or failure', async ({
  page,
}) => {
  await open(page)
  const surfaces = ['model', 'texture'].map((kind) =>
    page.locator(`#${kind}-preview-surface`),
  )
  for (const surface of surfaces)
    await expect(surface).toHaveAttribute('aria-busy', 'false')
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/__atlas/models/preview', async (route) => {
    await gate
    await route.continue()
  })
  try {
    await page.locator('#model-depth').fill('0.75')
    for (const surface of surfaces) {
      await expect(surface).toHaveAttribute('aria-busy', 'true')
      await expect(surface.locator('.preview-progress')).toBeVisible()
      expect(
        await surface
          .locator('.preview-progress')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe('rgba(0, 0, 0, 0)')
    }
  } finally {
    release()
  }
  for (const surface of surfaces)
    await expect(surface).toHaveAttribute('aria-busy', 'false')
  await page.unroute('**/__atlas/models/preview')
  await page.route('**/__atlas/models/preview', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Preview unavailable' }),
    }),
  )
  await page.locator('#model-depth').fill('1')
  await expect(page.locator('#models-status')).toContainText(
    'Preview unavailable',
  )
  for (const surface of surfaces) {
    await expect(surface).toHaveAttribute('aria-busy', 'false')
    await expect(surface.locator('.preview-progress')).toBeHidden()
  }
})

test('layer handles reorder by pointer and keyboard, preserve selection and allow cancellation', async ({
  page,
}) => {
  await open(page)
  const operations = async () => {
    const recipe = JSON.parse(await page.locator('#model-json').inputValue())
    return recipe.texture_edits[recipe.texture.id].map(
      (operation) => operation.label,
    )
  }
  await page.getByText('Recipe JSON', { exact: true }).click()
  const fixture = JSON.parse(await page.locator('#model-json').inputValue())
  fixture.texture_edits = {
    [fixture.texture.id]: Array.from({ length: 8 }, (_, i) => ({
      label: `Edit ${i + 1}`,
      source: [i, 0, i + 1, 1],
      target: [i, 0, i + 1, 1],
    })),
  }
  await page.locator('#model-json').fill(JSON.stringify(fixture))
  await page
    .getByRole('button', { name: 'Apply to draft', exact: true })
    .click()
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await page.getByText('Recipe JSON', { exact: true }).click()
  const original = await operations()
  const rows = page
    .locator('#texture-operations .sortable-list > li')
    .filter({ has: page.locator('.sortable-handle') })
  await page
    .locator('#texture-operations .sortable-list')
    .evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page
    .getByRole('button', { name: `Reorder ${original[0]}`, exact: true })
    .focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space')
  await expect(page.locator('[data-dnd-dropping]')).toHaveCount(0)
  await expect
    .poll(operations)
    .toEqual([original[1], original[0], ...original.slice(2)])
  await expect(page.locator('#texture-operation-label')).toHaveValue(
    original[0],
  )
  await page
    .getByRole('button', { name: `Reorder ${original[0]}`, exact: true })
    .focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-dnd-dropping]')).toHaveCount(0)
  await expect
    .poll(operations)
    .toEqual([original[1], original[0], ...original.slice(2)])

  const handle = rows.nth(1).locator('.sortable-handle')
  await page
    .locator('#texture-operations .sortable-list')
    .evaluate((element) => element.scrollIntoView({ block: 'center' }))
  const from = await handle.boundingBox(),
    to = await rows.nth(2).boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    from.x + from.width / 2,
    from.y + from.height / 2 + 10,
    { steps: 5 },
  )
  await page.mouse.move(from.x + from.width / 2, to.y + to.height * 0.8, {
    steps: 15,
  })
  await expect(
    page.locator('.sortable-list-item[data-dragging="true"]'),
  ).not.toHaveCount(0)
  expect(await operations()).toEqual([
    original[1],
    original[0],
    ...original.slice(2),
  ])
  await page.mouse.up()
  await expect(page.locator('[data-dnd-dropping]')).toHaveCount(0)
  await expect
    .poll(operations)
    .toEqual([original[1], original[2], original[0], ...original.slice(3)])
  await expect(page.locator('#texture-operation-label')).toHaveValue(
    original[0],
  )
  await page
    .getByRole('button', { name: 'Duplicate region', exact: true })
    .click()
  await expect.poll(async () => (await operations()).length).toBe(9)
  await expect(page.locator('#texture-operation-label')).toHaveValue(
    `${original[0]} copy`,
  )
  await page
    .getByRole('button', { name: 'Remove region 4', exact: true })
    .click()
  await expect.poll(async () => (await operations()).length).toBe(8)
  const add = page.getByRole('button', { name: 'Add region', exact: true })
  await add.hover()
  await expect(
    page.getByRole('tooltip', { name: 'Add region', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('tooltip', { name: 'Add region', exact: true }),
  ).toBeHidden()
  // The final delete queues an authoring preview. Let it finish before this
  // browser context closes and the next test asks for the same workspace.
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
})
