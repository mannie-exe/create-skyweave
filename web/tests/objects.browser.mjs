import { test, expect } from '@playwright/test'
const query =
  '/objects-preview?layout=a&object=entity%2Fminecraft%3Acreeper&case=rest'

test('Preview tools expands below the toolbar without moving its controls', async ({
  page,
}) => {
  for (const width of [1440, 800, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/resource-authoring')
    const toggle = page.getByRole('button', {
      name: 'Preview tools',
      exact: true,
    })
    await expect(toggle).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const toolbar = page.locator('.object-toolbar')
    const geometry = () =>
      toolbar.evaluate((element) =>
        [...element.querySelectorAll('input, button')].map((control) => {
          const { x, y, width, height } = control.getBoundingClientRect()
          return { x, y, width, height }
        }),
      )
    const closed = await geometry()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByRole('group', { name: 'Preview tools', exact: true }),
    ).toBeVisible()
    expect(await geometry()).toEqual(closed)
    await toggle.click()
    await expect(
      page.getByRole('group', { name: 'Preview tools', exact: true }),
    ).toBeHidden()
    expect(await geometry()).toEqual(closed)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
})

test('object catalogue groups authored recipes and compares real static mob geometry', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(query)
  await expect(
    page.locator('canvas[aria-label="Comparison A model"]'),
  ).toHaveAttribute('data-ready', 'entity/minecraft:creeper/rest')
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'entity/minecraft:creeper/rest')
  const data = await (
    await page.request.get('/generated/objects/index.json')
  ).json()
  expect(new Set(data.objects.map((object) => object.id)).size).toBe(
    data.objects.length,
  )
  expect(data.unassigned).toEqual([])
  await page.getByRole('button', { name: 'Half vertical', exact: true }).click()
  await expect(page.getByLabel('Comparison split')).toBeDisabled()
  await page.getByRole('button', { name: 'Slider', exact: true }).click()
  await expect(page.getByLabel('Comparison split')).toBeEnabled()
  await page.getByRole('button', { name: 'Textures', exact: true }).click()
  await expect(
    page.locator('.object-texture-grid canvas').first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page
    .getByLabel('Object part / material case')
    .selectOption('look-right')
  await expect(page.getByText('B: no supported preview')).toBeVisible()
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toBeHidden()
  await expect(
    page.locator('canvas[aria-label="Comparison A model"]'),
  ).toHaveAttribute('data-ready', 'entity/minecraft:creeper/look-right')
  expect(errors).toEqual([])
})

test('material variants keep the same object and expose exact authoring links', async ({
  page,
}) => {
  await page.goto(
    '/objects-preview?layout=b&object=block%2Flootr%3Alootr_barrel&case=barrel-looted',
  )
  await expect(page.locator('.object-authoring')).toHaveAttribute(
    'data-layout',
    'a',
  )
  await expect(page.getByLabel('Object part / material case')).toHaveValue(
    'barrel-looted',
  )
  await expect(
    page.getByRole('link', { name: 'Edit model', exact: true }),
  ).toHaveAttribute(
    'href',
    '/resource-authoring?view=models&recipe=lootr-barrel-looted-clasps',
  )
  await expect(
    page.getByRole('link', { name: 'Edit texture', exact: true }),
  ).toHaveAttribute(
    'href',
    '/resource-authoring?view=textures&texture=barrel-looted',
  )
  await page
    .getByLabel('Object part / material case')
    .selectOption('barrel-unlooted')
  await expect(
    page.getByRole('link', { name: 'Edit texture', exact: true }),
  ).toHaveAttribute(
    'href',
    '/resource-authoring?view=textures&texture=barrel-unlooted',
  )
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'barrel-unlooted')
  await page.setViewportSize({ width: 390, height: 850 })
  await expect(page.locator('.object-browser > summary')).toBeVisible()
  const scene = await page.locator('.object-scene').boundingBox(),
    inspector = await page.locator('.object-inspector').boundingBox()
  expect(inspector.y).toBeGreaterThan(scene.y)
  await page.goBack()
  await expect(page.getByLabel('Object part / material case')).toHaveValue(
    'barrel-looted',
  )
  await page.goForward()
  await expect(page.getByLabel('Object part / material case')).toHaveValue(
    'barrel-unlooted',
  )
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
})

test('registered custom stack previews reject arbitrary paths and do not save source', async ({
  page,
}) => {
  const writes = []
  page.on('request', (request) => {
    if (
      /\/__atlas\/(models\/(save|generate)|authoring\/)/.test(request.url()) &&
      request.method() === 'POST'
    )
      writes.push(request.url())
  })
  await page.goto(query)
  await expect(page.locator('canvas[data-ready]').first()).toBeVisible()
  const result = await page.evaluate(async () => {
    const index = await (await fetch('/generated/objects/index.json')).json()
    const object = index.objects.find(
        (object) => object.id === 'entity/minecraft:creeper',
      ),
      layers = object.profiles.selected.layers
    const response = await fetch('/__atlas/objects/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: object.id, case: 'rest', layers }),
    })
    const bad = await fetch('/__atlas/objects/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: object.id,
        case: 'rest',
        layers,
        path: '/tmp/escape',
      }),
    })
    return {
      status: response.status,
      body: await response.json(),
      bad: bad.status,
    }
  })
  expect(result.status).toBe(200)
  expect(result.bad).toBe(400)
  expect(result.body.preview.model.meshes.length).toBeGreaterThan(0)
  expect(
    result.body.evidence.some((entry) => entry.winner === 'fresh-animations'),
  ).toBe(true)
  expect(writes).toEqual([])
})

test('object editing reuses source tools and preserves drafts across literal artifact links', async ({
  page,
}) => {
  const errors = [],
    writes = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/\/__atlas\/models\/(save|generate)$/.test(request.url()))
      writes.push(request.url())
  })
  await page.goto(
    '/objects-preview?layout=a&object=block%2Flootr%3Alootr_barrel&case=barrel-unlooted',
  )
  await page.getByRole('link', { name: 'Edit model', exact: true }).click()
  await expect(page.locator('#model-label')).toBeVisible()
  await expect(page.locator('#model-label')).toHaveValue(
    'Lootr barrel: unlooted clasps',
  )
  await page.locator('#model-depth').fill('0.75')
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
  await page.getByRole('link', { name: 'Edit texture', exact: true }).click()
  await expect(page.locator('#texture-resource-title')).toHaveText(
    'Lootr barrel · Unlooted',
  )
  await page.locator('#texture-resource-related').click()
  await expect(page.locator('#model-depth')).toHaveValue('0.75')
  await page
    .getByRole('button', { name: 'Back to object', exact: true })
    .click()
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'barrel-unlooted')
  await page.getByRole('link', { name: 'Edit model', exact: true }).click()
  await expect(page.locator('#model-depth')).toHaveValue('0.75')
  await page
    .getByLabel('Object part / material case')
    .selectOption('barrel-looted')
  await expect(page.locator('#model-label')).toHaveValue(
    'Lootr barrel: looted clasps',
  )
  await page
    .getByLabel('Object part / material case')
    .selectOption('barrel-unlooted')
  await expect(page.locator('#model-depth')).toHaveValue('0.75')
  expect(errors).toEqual([])
  expect(writes).toEqual([])
  await expect(page.locator('#models-status')).toHaveText(
    'Unsaved changes; preview current',
  )
})

test('candidate links compare declared pack stacks and preserve unsupported whole-plant evidence', async ({
  page,
}) => {
  await page.goto('/resourcepacks')
  const candidates = page.locator('details').filter({
    has: page.locator('summary', { hasText: 'Object comparisons' }),
  })
  await candidates.locator('summary').click()
  await expect(
    candidates.getByRole('link', { name: 'Compare objects', exact: true }),
  ).toHaveCount(6)
  await candidates
    .getByRole('row')
    .filter({ hasText: 'Jacob' })
    .getByRole('link', { name: 'Compare objects', exact: true })
    .click()
  await expect(page.getByLabel('Comparison B', { exact: true })).toHaveValue(
    'candidate-jacobs-workspace-plus',
  )
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'block/minecraft:smoker/fixed-0')
  await page
    .getByLabel('Comparison B', { exact: true })
    .selectOption('candidate-3dvanilla')
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'block/minecraft:smoker/fixed-0')
  await page.goto(
    '/resource-authoring?object=block%2Fminecraft%3Apitcher_plant&a=pack&b=candidate-toastys-perfect-pitchers-3d-pitcher-plants',
  )
  await expect(
    page.locator('canvas[aria-label="Comparison A model"]'),
  ).toHaveAttribute('data-ready', 'block/minecraft:pitcher_plant/standing')
  await expect(page.getByText('B: no supported preview')).toBeVisible()
  await expect(
    page.getByText(/Element rotation is not supported by Minecraft 1.21.1/),
  ).toBeVisible()
  await page.getByLabel('Comparison B', { exact: true }).selectOption('pack')
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'block/minecraft:pitcher_plant/standing')
})

test('adult mob comparisons expose native, FA and selected geometry without evaluating animations', async ({
  page,
}) => {
  const data = await (
    await page.request.get('/generated/objects/index.json')
  ).json()
  for (const id of ['cow', 'pig', 'chicken', 'mooshroom']) {
    const entry = data.objects.find(
      (entry) => entry.registryId === 'minecraft:' + id,
    )
    const rest = entry.cases.find((value) => value.id === 'rest')
    expect(rest.previews.pack.supported).toBe(true)
    expect(rest.previews['fa-base'].supported).toBe(true)
  }
  await page.goto(
    '/resource-authoring?kind=entity&object=entity%2Fminecraft%3Achicken&case=rest&a=fa-base&b=pack',
  )
  await expect(
    page.locator('canvas[aria-label="Comparison A model"]'),
  ).toHaveAttribute('data-ready', 'entity/minecraft:chicken/rest')
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'entity/minecraft:chicken/rest')
  await expect(page.getByLabel('Comparison A', { exact: true })).toHaveValue(
    'fa-base',
  )
  await page.goto(
    '/resource-authoring?object=entity%2Fminecraft%3Amooshroom&case=rest&a=native&b=pack',
  )
  await expect(page.getByText('A: no supported preview')).toBeVisible()
  await expect(page.getByText(/native cow-body factory omits/)).toBeVisible()
  await expect(
    page.locator('canvas[aria-label="Comparison B model"]'),
  ).toHaveAttribute('data-ready', 'entity/minecraft:mooshroom/rest')
})
