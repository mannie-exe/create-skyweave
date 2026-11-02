import { expect } from '@playwright/test'

// Navigate through the same visible object/case controls used by authors.
export async function selectSource(page, kind, id) {
  const index = await (
    await page.request.get('/generated/objects/index.json')
  ).json()
  const key = kind === 'models' ? 'recipe' : 'textureResource'
  const object = index.objects.find((entry) =>
    entry.cases.some((variant) => variant[key] === id),
  )
  if (!object) throw new Error(`No registered object for ${kind}: ${id}`)
  const variant = object.cases.find((variant) => variant[key] === id)
  await page.getByLabel('Find object', { exact: true }).fill(object.registryId)
  const browser = page.locator('.object-browser')
  if ((await browser.getAttribute('open')) === null)
    await browser.locator('summary').first().click()
  await page
    .getByLabel('Resource objects', { exact: true })
    .getByRole('button')
    .filter({ hasText: object.label })
    .first()
    .click()
  await page.getByLabel('Object part / material case').selectOption(variant.id)
  const source = page.locator(
    kind === 'models' ? '#model-label' : '#texture-resource-title',
  )
  if (!(await source.isVisible()))
    await page
      .getByRole('link', {
        name: kind === 'models' ? 'Edit model' : 'Edit texture',
        exact: true,
      })
      .click()
  if (kind === 'models')
    await expect(page.locator('#model-canvas')).toHaveAttribute(
      'data-ready',
      id,
    )
  else await expect(source).toBeVisible()
}
