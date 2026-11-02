import { test, expect } from '@playwright/test'

const openGraph = async (page) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Progression graph', exact: true })
    .click()
  await expect(page.locator('#graph-canvas')).toHaveAttribute(
    'data-view',
    'systems',
  )
}

test('focused views retain real routes, source records and item inspection', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openGraph(page)
  const graph = page.locator('#graph-canvas')
  await expect(graph).toHaveAttribute('data-mode', 'detail')
  await expect(graph).toHaveAttribute('data-scene-nodes', '13')
  await expect(page.locator('#graph-counts')).toContainText('12 / 35')
  await page.locator('#graph-edge').selectOption({ index: 1 })
  await expect(page.locator('#graph-selection-title')).toHaveText(
    'Contributing routes',
  )
  await expect(page.locator('#graph-route-list button').first()).toBeVisible()
  await page.locator('[data-graph="processing"]').click()
  await expect(page.locator('#graph-counts')).toContainText(
    'Mechanical Press · 62 routes',
  )
  await page.locator('#graph-results [data-item="create:millstone"]').click()
  await expect(page.locator('#graph-counts')).toContainText('Millstone')
  await page.locator('#graph-route-list button').first().click()
  await expect(graph).toHaveAttribute('data-view', 'routes')
  await expect(page.locator('#graph-selection-data')).not.toHaveText('')
  await page.locator('#graph-search').fill('reliable_gliders:glider')
  await page
    .locator('#graph-results')
    .getByRole('button', { name: 'Glider', exact: true })
    .click()
  await expect(page.locator('#graph-item-title')).toHaveText('Glider')
  await page.locator('#graph-record').click()
  await expect(page.locator('#graph-selection-data')).toContainText(
    'reliable_gliders:glider',
  )
  await page.locator('#graph-inspect').click()
  await expect(page.locator('#detail h2')).toHaveText('Glider')
  await expect(page.locator('#detail')).toContainText(
    'Registry and asset provenance',
  )
  await page.locator('#close-inspector').click()
  await page.locator('#graph-relation').selectOption('uses')
  await expect(page.locator('#graph-counts')).toContainText('No modeled route')
  const catalog = await (
    await page.request.get('/generated/catalog.json')
  ).json()
  const unmapped = catalog.nodes.filter((item) => item.status === 'unmapped')
  const blocked = catalog.nodes.filter((item) => item.status === 'blocked')
  expect(unmapped.length).toBeGreaterThan(0)
  expect(blocked.length).toBeGreaterThan(0)
  await page.locator('[data-graph="coverage"]').click()
  await expect(page.locator('#graph-counts')).toContainText(
    `${unmapped.length.toLocaleString('en-US')} unmapped items`,
  )
  await page.locator('#graph-search').fill('')
  await page.locator('#graph-status').selectOption('blocked')
  await expect(page.locator('#graph-counts')).toContainText(
    `${blocked.length.toLocaleString('en-US')} blocked items`,
  )
  const entries = page.locator('#graph-results button[data-item]')
  await expect(entries).toHaveCount(Math.min(100, blocked.length))
  expect(
    await entries.evaluateAll((buttons) => buttons.map((b) => b.dataset.item)),
  ).toEqual(blocked.slice(0, 100).map((item) => item.id))
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(() => document.body.scrollWidth <= innerWidth),
  ).toBe(true)
  expect(errors).toEqual([])
})

test('graph navigation preserves cameras and limits mounted elements', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await openGraph(page)
  const graph = page.locator('#graph-canvas'),
    mini = page.locator('#graph-minimap')
  const canvasBox = await graph.boundingBox(),
    miniBox = await mini.boundingBox()
  expect(miniBox.y).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height)
  await mini.focus()
  const pan = await graph.getAttribute('data-pan-x')
  await page.keyboard.press('ArrowRight')
  await expect(graph).not.toHaveAttribute('data-pan-x', pan)
  await graph.focus()
  const oldZoom = Number(await graph.getAttribute('data-zoom'))
  await page.keyboard.press('+')
  await expect
    .poll(async () => Number(await graph.getAttribute('data-zoom')))
    .toBeGreaterThan(oldZoom)
  const stable = {
    zoom: await graph.getAttribute('data-zoom'),
    pan: await graph.getAttribute('data-pan-x'),
  }
  await page.locator('[data-graph="coverage"]').click()
  await page.locator('[data-graph="systems"]').click()
  await expect(graph).toHaveAttribute('data-zoom', stable.zoom)
  await expect(graph).toHaveAttribute('data-pan-x', stable.pan)
  await page.locator('#graph-reload').click()
  await expect(graph).toHaveAttribute('data-zoom', stable.zoom)
  await expect(graph).toHaveAttribute('data-pan-x', stable.pan)
  const before = await graph.getAttribute('data-pan-y')
  await mini.click({ position: { x: 70, y: 80 } })
  await expect(graph).not.toHaveAttribute('data-pan-y', before)
  await page.locator('#graph-fit').click()
  const box = await graph.boundingBox(),
    beforePan = await graph.getAttribute('data-pan-x')
  await page.mouse.move(box.x + 40, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + 190, box.y + 130, { steps: 15 })
  await page.mouse.up()
  await expect(graph).not.toHaveAttribute('data-pan-x', beforePan)
  await page.locator('[data-graph="processing"]').click()
  await page.locator('#graph-limit').selectOption('1000')
  expect(
    Number(await graph.getAttribute('data-rendered-nodes')),
  ).toBeLessThanOrEqual(1200)
  expect(
    Number(await graph.getAttribute('data-rendered-edges')),
  ).toBeLessThanOrEqual(3000)
  expect(errors).toEqual([])
})

test('item grid pans in both axes, retains clicks and navigates through minimap', async ({
  page,
}) => {
  await page.goto('/')
  const viewport = page.locator('#viewport'),
    mini = page.locator('#map-minimap')
  await expect(page.locator('#grid .cell').first()).toBeVisible()
  const scroll = () =>
    viewport.evaluate((v) => ({ x: v.scrollLeft, y: v.scrollTop }))
  const box = await viewport.boundingBox()
  await page.mouse.move(box.x + 500, box.y + 250)
  await page.mouse.down()
  await page.mouse.move(box.x + 250, box.y + 100, { steps: 15 })
  await page.mouse.up()
  await expect.poll(async () => (await scroll()).x).toBeGreaterThan(100)
  await expect.poll(async () => (await scroll()).y).toBeGreaterThan(50)
  await expect(page.locator('#inspector')).toBeHidden()
  await mini.focus()
  const previous = await scroll()
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => (await scroll()).y).toBeGreaterThan(previous.y)
  await mini.click({ position: { x: 70, y: 65 } })
  await expect.poll(async () => (await scroll()).y).toBeGreaterThan(1000)
  expect(await page.locator('#grid .cell').count()).toBeLessThan(300)
  await page.locator('#search').fill('reliable_gliders:glider')
  await expect(page.locator('#grid .cell')).toHaveCount(1)
  await page.locator('#grid .cell').click()
  await expect(page.locator('#detail h2')).toHaveText('Glider')
  await page.locator('#close-inspector').click()
  await page.locator('#search').fill('no-such-item-xyz')
  await expect(page.locator('#grid .cell')).toHaveCount(0)
  await mini.focus()
  await page.keyboard.press('Home')
  expect(await scroll()).toEqual({ x: 0, y: 0 })
  expect(
    await viewport.evaluate((v) => getComputedStyle(v).scrollbarWidth),
  ).toBe('none')
})

test('graph source strings render literally and missing routes remain explicit', async ({
  page,
}) => {
  await page.route('**/generated/catalog.json', (route) =>
    route.fulfill({
      json: {
        nodes: [
          {
            id: 'test:item',
            name: '<img src=x onerror=alert(1)>',
            mod: 'test',
            status: 'unmapped',
            depth: null,
            x: 0,
            y: 0,
            icon: 'x" onerror="window.__atlasIconInjected=true',
          },
        ],
        meta: { minecraft: '1.21.1', counts: {} },
      },
    }),
  )
  await page.route('**/generated/routes.json', (route) =>
    route.fulfill({ json: [] }),
  )
  await openGraph(page)
  await expect(page.locator('#graph-results')).toContainText('<img src=x')
  await expect(page.locator('#graph-results img')).toHaveCount(0)
  await expect(page.locator('#grid img')).toHaveCount(0)
  expect(await page.evaluate(() => window.__atlasIconInjected)).toBeUndefined()
  await page.locator('#graph-results button').click()
  await expect(page.locator('#graph-counts')).toContainText('No modeled route')
  await expect(page.locator('#graph-recipe')).toBeDisabled()
})

test('item map opens vertical paths and shared recipes remain inspectable', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.locator('#search').fill('reliable_gliders:glider')
  await page.locator('#grid .cell').click()
  const recipe = page.locator(
    '.method-detail [data-recipe="reliable_gliders:glider"]',
  )
  await expect(recipe.locator('.recipe-grid > .recipe-slot')).toHaveCount(9)
  await expect(recipe.locator('.recipe-grid .empty')).toHaveCount(1)
  await expect(recipe.locator('.recipe-grid img').first()).toBeVisible()
  await page.locator('#view-item-route').click()
  await expect(page.locator('#inspector')).toBeHidden()
  await expect(page.locator('#graph-counts')).toContainText(
    'Planned first access',
  )
  await expect(page.locator('#graph-route-view')).toHaveValue('path')
  await expect(page.locator('#graph-relation')).toBeDisabled()
  const capability = await page
    .locator('#graph-node option')
    .evaluateAll(
      (options) => options.find((o) => o.value.startsWith('atlas:'))?.value,
    )
  expect(capability).toBeTruthy()
  await page.locator('#graph-node').selectOption(capability)
  await expect(page.locator('#graph-selection-summary')).toContainText(
    'environmental requirement',
  )
  const option = await page
    .locator('#graph-node option')
    .evaluateAll(
      (options) => options.find((o) => o.value.endsWith(':route'))?.value,
    )
  expect(option).toBeTruthy()
  await page.locator('#graph-node').selectOption(option)
  await expect(page.locator('#graph-selection-data')).not.toHaveText('')
  await page.locator('#graph-route-view').selectOption('single')
  await expect(page.locator('#graph-recipe-preview .recipe-grid')).toBeVisible()
  await page
    .locator(
      '#graph-recipe-preview [data-inspect="minecraft:phantom_membrane"]',
    )
    .first()
    .click()
  await expect(page.locator('#detail h2')).toHaveText('Phantom Membrane')
  await page.locator('#close-inspector').click()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(() => document.body.scrollWidth <= innerWidth),
  ).toBe(true)
  expect(errors).toEqual([])
})

test('Evidence uses the shared recipe renderer, including fallback records', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('[data-view="evidence"]').click()
  await page.locator('#evidence-domain').selectOption('recipes')
  await page.locator('#evidence-search').fill('create:mixing/brass_ingot')
  const card = page.locator('#evidence-list > details').first()
  await card.locator(':scope > summary').click()
  await expect(card.locator('.recipe-grid > .recipe-slot')).toHaveCount(2)
  await expect(card.locator('.recipe-outputs .recipe-count')).toHaveText('2')
  await expect(card.locator('.recipe-conditions')).toContainText('heated')
  await page.locator('#evidence-search').fill('create:sequenced_assembly')
  const fallback = page.locator('#evidence-list > details').first()
  await fallback.locator(':scope > summary').click()
  await expect(fallback).toContainText('No visual adapter')
  await expect(fallback.locator('.recipe-grid')).toHaveCount(0)
})

test('recipe nodes are interactive and keep disclosure state across culling', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('#search').fill('reliable_gliders:glider')
  await page.locator('#grid .cell').click()
  await page.locator('#view-item-route').click()
  const canvas = page.locator('#graph-canvas')
  const node = canvas
    .locator('.react-flow__node')
    .filter({ has: page.locator('[data-recipe="reliable_gliders:glider"]') })
  await expect(node).toBeVisible()
  const disclosure = node.locator('.recipe-ingredients')
  await disclosure.locator(':scope > summary').click()
  await expect(disclosure).toHaveAttribute('open', '')
  const step = page.locator('#graph-node')
  const selected = await node.getAttribute('data-id')
  await step.selectOption(selected)
  await canvas.focus()
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown')
  await expect(node).toHaveCount(0)
  await step.selectOption(selected)
  await expect(node).toBeVisible()
  await expect(disclosure).toHaveAttribute('open', '')
  await node
    .locator('[data-inspect="minecraft:phantom_membrane"]')
    .first()
    .click()
  await expect(page.locator('#detail h2')).toHaveText('Phantom Membrane')
  await page.locator('#close-inspector').click()
  await expect(
    canvas.locator(
      '[data-recipe="reliable_gliders:glider"] .recipe-ingredients',
    ),
  ).toHaveAttribute('open', '')
})

test('initial fit uses the measured narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openGraph(page)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  const canvas = page.locator('#graph-canvas')
  const camera = () =>
    canvas.evaluate((node) => [
      Number(node.dataset.zoom),
      Number(node.dataset.panX),
      Number(node.dataset.panY),
    ])
  const initial = await camera()
  await page.locator('#graph-fit').click()
  const fitted = await camera()
  for (let i = 0; i < initial.length; i++)
    expect(initial[i]).toBeCloseTo(fitted[i], 3)
})
