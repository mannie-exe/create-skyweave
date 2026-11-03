import { test, expect } from '@playwright/test'
const danger = 'rgb(180, 35, 24)'
const button = (page, name) => page.getByRole('button', { name, exact: true })

test('destructive actions retain their meaning across hover, focus and disabled states', async ({
  page,
}) => {
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  const remove = button(page, 'Delete entry')
  await expect(remove).toHaveAttribute('data-intent', 'destructive')
  await expect(remove).toHaveAttribute('type', 'button')
  await expect(remove).toHaveCSS('color', danger)
  await remove.hover()
  await expect(remove).toHaveCSS('color', danger)
  await remove.focus()
  await expect(remove).toHaveCSS('outline-style', 'solid')
  page.once('dialog', (dialog) => dialog.dismiss())
  await remove.click()
  await expect(
    page.getByRole('heading', { name: 'Glider', level: 2, exact: true }),
  ).toBeVisible()
  await expect(button(page, 'Reload source')).toHaveAttribute(
    'data-intent',
    'default',
  )
  await button(page, 'Add reward').click()
  await expect(button(page, 'Remove reward 1')).toHaveAttribute(
    'data-intent',
    'destructive',
  )
  await expect(button(page, 'Reload source')).toHaveAttribute(
    'data-intent',
    'destructive',
  )
  const save = button(page, 'Save journal')
  await expect(save).toHaveAttribute('data-intent', 'primary')
  await save.hover()
  await expect(save).toHaveCSS('color', 'rgb(255, 255, 255)')
  await button(page, 'Disclaimers').click()
  const used = button(page, 'Delete disclaimer')
  await expect(used).toBeDisabled()
  const before = await used.evaluate((el) => getComputedStyle(el).color)
  await used.hover({ force: true })
  await expect(used).toHaveCSS('color', before)
  expect(before).not.toBe(danger)
  await button(page, 'New disclaimer').click()
  await button(page, 'Create disclaimer').click()
  await expect(page.getByRole('alert')).toHaveCSS('color', danger)
  await expect(button(page, 'Cancel')).toHaveAttribute('data-intent', 'default')
  await page.setViewportSize({ width: 390, height: 850 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('locale removal and fallback are destructive, navigation is not', async ({
  page,
}) => {
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  await button(page, 'Localization').click()
  await page.getByText('Manage locales', { exact: true }).click()
  await page.getByLabel('Language to add').selectOption('de_de')
  await button(page, 'Add locale').click()
  await expect(button(page, 'Delete de_de locale')).toHaveAttribute(
    'data-intent',
    'destructive',
  )
  await page.getByLabel('Find key or text').fill('entries.travel/glider.title')
  await page
    .getByLabel('Translation entries.travel/glider.title', { exact: true })
    .fill('Gleiter')
  await expect(button(page, 'Use English')).toHaveAttribute(
    'data-intent',
    'destructive',
  )
  await expect(button(page, 'All strings')).toHaveAttribute(
    'data-intent',
    'default',
  )
})

test('Astro controls and DOM feedback share the React semantics', async ({
  page,
}) => {
  await page.goto('/model-authoring')
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  await expect(page.locator('#models-save')).toHaveAttribute(
    'data-intent',
    'primary',
  )
  await expect(page.locator('#models-reload')).toHaveAttribute(
    'data-intent',
    'default',
  )
  await expect(page.locator('#model-camera')).toHaveAttribute(
    'data-intent',
    'default',
  )
  await page.getByText('Recipe JSON', { exact: true }).click()
  await page.locator('#model-json').fill('{bad json')
  await expect(page.locator('#model-discard-json')).toHaveCSS('color', danger)
  await expect(page.locator('#models-reload')).toHaveAttribute(
    'data-intent',
    'destructive',
  )
  await page.locator('#model-apply-json').click()
  await expect(page.locator('#models-status')).toHaveAttribute(
    'data-tone',
    'error',
  )
  await expect(page.locator('#models-status')).toHaveCSS('color', danger)
  await page.locator('#model-discard-json').click()
  await expect(page.locator('#models-status')).toHaveAttribute(
    'data-tone',
    'neutral',
  )
})

test('map source reload distinguishes unsaved edits from ordinary refresh', async ({
  page,
}) => {
  await page.goto('/?view=editor')
  await page.getByRole('button', { name: 'Edit data', exact: true }).click()
  await expect(page.locator('#domain-editor')).not.toHaveValue('')
  await expect(page.locator('#save-editor')).toHaveAttribute(
    'data-intent',
    'primary',
  )
  await expect(page.locator('#reload-editor')).toHaveAttribute(
    'data-intent',
    'default',
  )
  await page.locator('#domain-editor').fill('# unsaved draft')
  await expect(page.locator('#reload-editor')).toHaveAttribute(
    'data-intent',
    'destructive',
  )
})

for (const path of [
  '/',
  '/authoring',
  '/resource-authoring',
  '/resourcepacks',
]) {
  test(`header keyboard shortcut reaches content on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 850 })
    await page.goto(path)
    if (path === '/resource-authoring')
      await expect(
        page.getByLabel('Find object', { exact: true }),
      ).toBeVisible()
    if (path === '/authoring')
      await expect(
        page.getByRole('status').filter({ hasText: 'Source loaded' }),
      ).toBeVisible()
    const main = page.getByRole('main')
    await expect(main).toBeVisible()
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    const bounds = await skip.boundingBox()
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
    await page.keyboard.press('Enter')
    await expect(main).toBeFocused()
    await page.keyboard.press('Tab')
    expect(
      await main.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true)
  })
}
