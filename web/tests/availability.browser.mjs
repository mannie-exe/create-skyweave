import { test, expect } from '@playwright/test'

test('environment-aware methods follow the graph policy, preserve manual choices and explain unavailable sources', async ({
  page,
}) => {
  const item = 'minecraft:iron_ingot'
  const method = (id, input, fields = {}) => ({
    id,
    kind: 'authored',
    title: id,
    inputs: [[input]],
    outputs: [item],
    facts: { outcomes: { [item]: { probability: 1 } } },
    ...fields,
  })
  const routes = [
    {
      id: 'fixture:mine',
      kind: 'gathering',
      inputs: [['atlas:overworld']],
      outputs: ['minecraft:raw_iron'],
      facts: { outcomes: { 'minecraft:raw_iron': { probability: 1 } } },
    },
    method('fixture:smelt', 'minecraft:raw_iron'),
    method('fixture:loot', 'atlas:overworld', {
      kind: 'chest-loot',
      facts: { opportunistic: true, outcomes: { [item]: { probability: 1 } } },
    }),
    method('fixture:closed', 'atlas:nether', {
      availability: {
        state: 'blocked',
        reason: 'Nether access is disabled by the server template',
      },
    }),
    method('fixture:unknown', 'atlas:overworld', {
      availability: { state: 'unknown', reason: 'No admitted source binding' },
    }),
    method('fixture:unresolved', 'atlas:nether'),
  ]
  await page.route('**/generated/catalog.json', async (route) => {
    const data = await (await route.fetch()).json()
    data.nodes = data.nodes
      .filter((node) => node.id === item)
      .map((node) => ({ ...node, x: 0, y: 0, status: 'mapped', depth: 2 }))
    data.meta.environment = {
      context: 'dedicated',
      dimensions: {
        'minecraft:overworld': {
          id: 'minecraft:overworld',
          gate: 'atlas:overworld',
          state: 'potential',
        },
        'minecraft:the_nether': {
          id: 'minecraft:the_nether',
          gate: 'atlas:nether',
          state: 'blocked',
        },
      },
    }
    await route.fulfill({ json: data })
  })
  await page.route('**/generated/routes.json', (route) =>
    route.fulfill({ json: routes }),
  )
  await page.route('**/generated/recipes.json', (route) =>
    route.fulfill({ json: [] }),
  )
  await page.route('**/generated/authored.json', async (route) => {
    const data = await (await route.fetch()).json()
    data.progression.roots = ['atlas:overworld', 'atlas:nether']
    data.acquisition.records = []
    await route.fulfill({ json: data })
  })
  await page.route('**/generated/details/**/*.json', async (route) => {
    const data = await (await route.fetch()).json()
    if (data[item]) {
      data[item].path = [{ id: item, route: 'fixture:smelt' }]
      data[item].earliestPath = [{ id: item, route: 'fixture:loot' }]
    }
    await route.fulfill({ json: data })
  })
  await page.goto('/')
  await expect(page.locator('#environment-summary')).toContainText(
    'Nether closed',
  )
  await page.locator(`[data-id="${item}"]`).click()
  const selected = page.locator('[data-selected-method]')
  await expect(selected).toHaveAttribute(
    'data-selected-method',
    'fixture:smelt',
  )
  await page.locator('#progression-policy').selectOption('earliest')
  await expect(selected).toHaveAttribute('data-selected-method', 'fixture:loot')
  await page.locator('[data-method-id="fixture:closed"]').click()
  await expect(
    page.locator('[data-method-availability="blocked"]'),
  ).toContainText('Nether access is disabled')
  await page.locator('#progression-policy').selectOption('planned')
  await expect(selected).toHaveAttribute(
    'data-selected-method',
    'fixture:closed',
  )
  await page.locator('[data-method-id="fixture:unknown"]').click()
  await expect(
    page.locator('[data-method-availability="unknown"]'),
  ).toContainText('No admitted source binding')
  await expect(
    page.locator('[data-method-id="fixture:unresolved"]'),
  ).toContainText('Unresolved prerequisites')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page
      .locator('#detail')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true)
})
