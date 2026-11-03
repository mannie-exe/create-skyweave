import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'

test('built map and posed resources use checked static assets without a workspace connection', async ({
  page,
  request,
}) => {
  const manifest = await (
    await request.get('/workspace-snapshot/manifest.json')
  ).json()
  expect(manifest.delivery).toBe('open-static')
  expect(manifest.public).toBe(true)
  let sockets = 0
  const backend = [],
    errors = []
  page.on('websocket', () => sockets++)
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/__atlas/'))
      backend.push(req.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute(
    'data-workspace-delivery',
    'open-static',
  )
  const catalog = manifest.projections.map?.files['catalog.json']
  if (catalog) {
    const response = await request.get(catalog.url),
      bytes = await response.body()
    expect(response.headers()['content-type']).toContain('application/json')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      catalog.sha256,
    )
    expect(bytes.length).toBe(catalog.byteLength)
    await expect(page.locator('#counts')).toContainText('items')
    const image = page.locator('#grid img').first()
    await expect(image).toHaveAttribute('src', /^\/workspace-snapshot\//)
    await expect
      .poll(() =>
        image.evaluate(
          (element) => element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Edit data', exact: true }).click()
    await expect(page.locator('#save-editor')).toBeDisabled()
    await expect(page.locator('#refresh-data')).toBeDisabled()
  } else
    await expect(page.locator('#counts')).toContainText('No generated snapshot')
  await page.goto(
    '/resource-authoring?object=entity%2Fminecraft%3Acreeper&case=rest',
  )
  if (manifest.projections.objects) {
    await expect(
      page.locator('canvas[aria-label="Comparison A model"]'),
    ).toHaveAttribute('data-ready', 'entity/minecraft:creeper/rest')
    await expect(
      page.getByRole('button', { name: 'Refresh previews', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Preview tools', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Export static models', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Fetch candidate inputs', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('link', { name: 'Edit model', exact: true }),
    ).toHaveCount(0)
  }
  expect(sockets).toBe(0)
  expect(backend).toEqual([])
  expect(errors).toEqual([])
})
