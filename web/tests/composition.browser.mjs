import { test, expect } from '@playwright/test'
const center = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.y + r.height / 2
  })
test('quest navigation aligns controls and disclosures separate inline metadata', async ({
  page,
}) => {
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  const nav = page.getByRole('navigation', {
    name: 'Authoring views',
    exact: true,
  })
  expect(
    Math.abs(
      (await center(nav.getByRole('button', { name: 'Quests', exact: true }))) -
        (await center(
          nav.getByRole('link', { name: 'Resources', exact: true }),
        )),
    ),
  ).toBeLessThan(1)
  await page.getByRole('button', { name: 'Localization', exact: true }).click()
  await page.getByLabel('Find key or text').fill('shared.suggested_project')
  const keys = page.locator('.quest-string-table .disclosure')
  const body = keys.locator(':scope > .content-stack')
  await expect(body).toBeHidden()
  await keys.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(body).toBeVisible()
  expect(await body.innerText()).toBe(
    'shared.suggested_project\nComposed into descriptions',
  )
  const gap = await body.evaluate(
    (el) =>
      el.children[1].getBoundingClientRect().top -
      el.children[0].getBoundingClientRect().bottom,
  )
  expect(gap).toBeGreaterThan(0)
  await page.addStyleTag({ content: ':root { --space-control: 24px; }' })
  const increased = await body.evaluate(
    (el) =>
      el.children[1].getBoundingClientRect().top -
      el.children[0].getBoundingClientRect().bottom,
  )
  expect(increased).toBeGreaterThan(gap)
  for (const width of [900, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(await body.innerText()).toContain('shared.suggested_project\n')
  }
  await keys.locator('summary').focus()
  await page.keyboard.press('Space')
  await expect(body).toBeHidden()
})
test('survey headings and generated disclosures follow the same composition contract', async ({
  page,
}) => {
  await page.goto('/?view=world')
  await expect(page.locator('#ore-profile svg')).toBeVisible()
  const titles = ['Ore availability', 'Region map', 'Vertical ore profile']
  const positions = await Promise.all(
    titles.map((name) =>
      center(page.getByRole('heading', { name, exact: true })),
    ),
  )
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1)
  const details = page.locator('#island-survey .disclosure').first()
  await details.locator('summary').click()
  const body = details.locator(':scope > .content-stack')
  await expect(body).toBeVisible()
  await expect(body.locator('table')).toBeVisible()
  expect(await body.evaluate((el) => getComputedStyle(el).display)).toBe('flex')
  await page.getByRole('button', { name: 'Evidence', exact: true }).click()
  await page.locator('#evidence-domain').selectOption('acquisition')
  const record = page.locator('#evidence-list .disclosure').first()
  await record.locator('summary').click()
  await expect(record.locator(':scope > .content-stack > pre')).toBeVisible()
})

test('model fields and preview actions use aligned control rows', async ({
  page,
}) => {
  await page.goto('/model-authoring')
  await expect(page.locator('#models-status')).toHaveText('Source loaded')
  const labelInput = page.locator('#model-label')
  const includeLabel = page
    .locator('label')
    .filter({ has: page.locator('#model-enabled') })
  expect(
    Math.abs((await center(labelInput)) - (await center(includeLabel))),
  ).toBeLessThan(1)
  const headings = ['Texture region', 'Model'].map((name) =>
    page.getByRole('heading', { name, exact: true }),
  )
  expect(
    Math.abs((await center(headings[0])) - (await center(headings[1]))),
  ).toBeLessThan(1)
  const wire = page
    .locator('label')
    .filter({ has: page.locator('#model-wire') })
  expect(
    Math.abs(
      (await center(wire)) - (await center(page.locator('#model-camera'))),
    ),
  ).toBeLessThan(1)
})
