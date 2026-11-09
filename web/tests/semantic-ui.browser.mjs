import { test, expect } from '@playwright/test'

const selection = `:root {
  --surface-selected: rgb(225, 245, 230);
  --ink-selected: rgb(30, 80, 45);
  --line-selected: rgb(30, 80, 45);
  --ink-expanded: rgb(95, 40, 100);
  --line-expanded: rgb(95, 40, 100);
}`
async function selected(control) {
  await control.page().mouse.move(0, 0)
  await expect(control).toHaveCSS('background-color', 'rgb(225, 245, 230)')
  await expect(control).toHaveCSS('color', 'rgb(30, 80, 45)')
  expect(await control.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe(
    'none',
  )
  // Hover has its own derived surface; it must retain the selected ink/marker.
  await control.hover()
  await expect(control).toHaveCSS('color', 'rgb(30, 80, 45)')
}

test('selection and expansion share roles across React, Astro and generated controls', async ({
  page,
}) => {
  await page.goto('/resource-authoring')
  const models = page.getByRole('button', { name: 'Models', exact: true })
  const textures = page.getByRole('button', { name: 'Textures', exact: true })
  await expect(models).toBeEnabled()
  await page.addStyleTag({ content: selection })
  await selected(models)
  await expect(textures).not.toHaveCSS('background-color', 'rgb(225, 245, 230)')
  await textures.click()
  await selected(textures)
  await expect(models).toHaveAttribute('aria-pressed', 'false')
  const tools = page.getByRole('button', { name: 'Preview tools', exact: true })
  await tools.click()
  await expect(tools).toHaveCSS('border-color', 'rgb(95, 40, 100)')
  await expect(tools).not.toHaveCSS('background-color', 'rgb(225, 245, 230)')
  await tools.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(tools).toHaveCSS('outline-style', 'solid')

  await page.goto('/?view=world')
  const zinc = page.getByRole('button', { name: 'Zinc Ore', exact: true })
  await zinc.click()
  await page.addStyleTag({ content: selection })
  await selected(zinc)
  const world = page.getByRole('button', { name: 'World & ores', exact: true })
  await selected(world)
  await page.getByRole('button', { name: 'Item map', exact: true }).click()
  await page.locator('#search').fill('reliable_gliders:glider')
  const cell = page.locator('[data-id="reliable_gliders:glider"]')
  await cell.click()
  await expect(cell).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('button', { name: 'Acquisition', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#detail [data-detail-tab="evidence"]').click()
  await selected(page.locator('#detail [data-detail-tab="evidence"]'))
})

test('shared typography, form insets and disclosure spacing respond on real pages', async ({
  page,
}) => {
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Localization', exact: true }).click()
  await page.getByLabel('Find key or text').fill('shared.suggested_project')
  const keys = page.locator('.quest-string-table .disclosure')
  await keys.locator('summary').click()
  const body = keys.locator(':scope > .content-stack')
  const gap = await body.evaluate(
    (e) =>
      e.children[1].getBoundingClientRect().top -
      e.children[0].getBoundingClientRect().bottom,
  )
  await page.addStyleTag({
    content:
      ':root { --space-control: 24px; --type-caption-size: 16px; --type-label-size: 15px; }',
  })
  expect(
    await body.evaluate(
      (e) =>
        e.children[1].getBoundingClientRect().top -
        e.children[0].getBoundingClientRect().bottom,
    ),
  ).toBeGreaterThan(gap)
  await expect(page.locator('.scope').first()).toHaveCSS('font-size', '16px')
  await expect(page.locator('.field > label').first()).toHaveCSS(
    'font-size',
    '15px',
  )
  const text = page.locator('textarea').first()
  await expect(text).toHaveCSS('padding-left', '24px')
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await page.goto('/resourcepacks/reviews')
  await expect(page.locator('.comparison-index button').first()).toBeEnabled()
  await page.addStyleTag({
    content: ':root { --type-caption-size: 16px; --space-control: 24px; }',
  })
  await expect(page.locator('.comparison-index small').first()).toHaveCSS(
    'font-size',
    '16px',
  )
  // A plain review textarea has the same shared insets as journal controls.
  await expect(page.locator('textarea').first()).toHaveCSS(
    'padding-left',
    '24px',
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Evidence', exact: true }).click()
  await expect(page.locator('#evidence-list .record').first()).toBeVisible()
  await page.addStyleTag({
    content: ':root { font-size: 125%; --type-body-size: 18px; }',
  })
  // Registry identifiers must wrap rather than push a narrow document wider.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const current = page
    .getByRole('navigation', { name: 'Atlas pages', exact: true })
    .locator('[aria-current="page"]')
  const background = await current.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  )
  await current.hover()
  await expect(current).toHaveCSS('background-color', background)
})
