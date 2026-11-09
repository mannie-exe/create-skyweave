import { test, expect } from '@playwright/test'

test('coverage status controls grid and minimap colors independently of depth and notes', async ({
  page,
}) => {
  const states = [
    'mapped',
    'blocked',
    'unmapped',
    'excluded',
    'unified',
    'blocked',
    'unknown',
  ]
  await page.route('**/generated/catalog.json', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    data.nodes = states.map((status, i) => ({
      ...data.nodes[0],
      id: `fixture:item_${i}`,
      name: `Fixture ${i}`,
      x: i,
      y: 0,
      depth: 2,
      family: 'production',
      progression: undefined,
      status,
      hasNote: i === 5,
    }))
    await route.fulfill({ json: data })
  })
  await page.addInitScript(() => {
    window.minimapColors = []
    const fill = CanvasRenderingContext2D.prototype.fillRect
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (w === 2 && h === 2) window.minimapColors.push(this.fillStyle)
      return fill.call(this, x, y, w, h)
    }
  })
  await page.goto('/')
  await expect(page.locator('#grid .cell')).toHaveCount(7)
  const markers = await page.locator('#grid .cell').evaluateAll((cells) =>
    cells.map((cell) => {
      const marker = getComputedStyle(cell, '::after')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      context.fillStyle = marker.borderBottomColor
      return { color: context.fillStyle, line: marker.borderBottomStyle }
    }),
  )
  expect(markers[0].color).not.toBe(markers[1].color)
  expect(markers[1].color).not.toBe(markers[2].color)
  expect(markers[2].line).toBe('dashed')
  expect(markers[3].color).toBe(markers[4].color)
  expect(markers[5].color).toBe(markers[1].color)
  expect(await page.evaluate(() => window.minimapColors.slice(-7))).toEqual(
    markers.map((marker) => marker.color),
  )
  await expect(page.locator('#grid .note-indicator')).toHaveCount(1)
  await expect(page.locator('[data-id="fixture:item_5"]')).toHaveAccessibleName(
    /Blocked prerequisites.*review note/,
  )
  for (const [i, status] of states.entries()) {
    await expect(page.locator(`[data-id="fixture:item_${i}"]`)).toHaveAttribute(
      'data-coverage',
      status,
    )
  }
  await page.locator('#route-filter').selectOption('known')
  await expect(page.locator('#grid .cell')).toHaveCount(1)
  await expect(page.locator('#grid .cell')).toHaveAttribute(
    'data-coverage',
    'mapped',
  )
  await page.locator('#route-filter').selectOption('unknown')
  await expect(page.locator('#grid .cell')).toHaveCount(1)
  await expect(page.locator('#grid .cell')).toHaveAttribute(
    'data-coverage',
    'unknown',
  )
  await page.locator('#route-filter').selectOption('unresolved')
  await expect(page.locator('#grid .cell')).toHaveCount(4)
  await page.locator('#coverage-summary [data-coverage="unknown"]').click()
  await expect(page.locator('#grid .cell')).toHaveCount(1)
  await expect(page.locator('#grid .cell')).toHaveAttribute(
    'data-coverage',
    'unknown',
  )
  await page.locator('#route-filter').selectOption('notes')
  await expect(page.locator('#grid .cell')).toHaveCount(1)
  await expect(page.locator('#grid .cell')).toHaveAttribute(
    'data-id',
    'fixture:item_5',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
})
