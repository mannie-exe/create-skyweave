import { test, expect } from '@playwright/test'
import { mockWorkspace } from './workspace-fixture.mjs'

// Exercise editing against a disposable in-memory source, never the user's reviews.
async function mockSource(page) {
  let snapshot = await (
    await page.request.get('/__atlas/resource-reviews')
  ).json()
  snapshot = { ...snapshot, document: { schema: 1, reviews: {} } }
  let conflict = false
  let version = 0
  const inventory = () => ({
    entries: [
      { id: 'review-media', revision: String(version).padStart(64, '0') },
    ],
    revision: String(version).padStart(64, '0'),
    monitoring: 'ready',
    restartRequired: false,
  })
  const wire = await mockWorkspace(
    page,
    async (frame) => {
      if (frame.operation === 'sources.inventory') return inventory()
      if (frame.operation === 'reviews.read') return snapshot
      if (frame.operation !== 'reviews.save')
        throw new Error('Unexpected review operation')
      const input = frame.payload
      if (conflict)
        throw Object.assign(
          new Error(
            'Reviews changed. Reload saved reviews before saving again.',
          ),
          { code: 'REVISION_CONFLICT' },
        )
      snapshot = {
        ...snapshot,
        revision: 'saved-' + input.feature,
        document: {
          schema: 1,
          reviews: {
            ...snapshot.document.reviews,
            ['selective-20261101/' + input.feature]: {
              ...input.review,
              evidence: snapshot.evidence,
            },
          },
        },
      }
      return snapshot
    },
    ['reviews.read', 'reviews.save', 'sources.inventory'],
    { snapshot: () => inventory() },
  )
  return {
    conflict: () => {
      conflict = true
    },
    changeCatalogue(title) {
      snapshot = {
        ...snapshot,
        catalogue: snapshot.catalogue.map((feature) =>
          feature.id === 'barrels' ? { ...feature, title } : feature,
        ),
      }
      version++
      wire.emit('sources', {
        kind: 'invalidated',
        sources: ['review-media'],
        external: true,
      })
    },
  }
}

test('live capture catalogues refresh clean views and keep notes while evidence changes', async ({
  page,
}) => {
  const source = await mockSource(page)
  await page.goto('/resourcepacks/reviews')
  await expect(
    page.getByRole('button', { name: 'Barrels', exact: false }),
  ).toBeVisible()
  source.changeCatalogue('Updated barrels')
  await expect(
    page.getByRole('button', { name: 'Updated barrels', exact: false }),
  ).toBeVisible()
  await page.getByLabel('What works or needs changing?').fill('Keep my notes')
  source.changeCatalogue('New capture set')
  await expect(page.getByRole('alert')).toContainText(
    'Your drafts are preserved',
  )
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Keep my notes',
  )
  await page.getByRole('button', { name: 'Reload saved reviews' }).click()
  await expect(
    page.getByRole('button', { name: 'New capture set', exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Keep my notes',
  )
})

test('find comparisons, save dated notes, retain other drafts and preserve edits on conflict', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const source = await mockSource(page)
  await page.goto('/resourcepacks')
  await page
    .getByRole('link', { name: 'Compare captures', exact: true })
    .click()
  await expect(page.getByLabel('Preference', { exact: true })).toBeEnabled()
  await page
    .getByLabel('Compare with', { exact: true })
    .selectOption('nautilus-3d')
  await expect(
    page.locator('.image-comparison-canvas img').last(),
  ).toHaveAttribute('src', /nautilus3d/)
  await page
    .getByLabel('Preference', { exact: true })
    .selectOption('nautilus-3d')
  await page
    .getByLabel('What works or needs changing?')
    .fill('Compare the edge depth.')
  await page.getByRole('button', { name: 'Chests and Lootr' }).click()
  await page
    .getByLabel('What works or needs changing?')
    .fill('Check the animation.')
  await page.getByRole('button', { name: 'Barrels', exact: false }).click()
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Compare the edge depth.',
  )
  await page.getByRole('button', { name: 'Save review', exact: true }).click()
  await expect(
    page.getByText('Barrels review saved. Pack selections are unchanged.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Chests and Lootr' }).click()
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Check the animation.',
  )
  await page.getByRole('button', { name: 'Revert draft', exact: true }).click()
  await page.getByRole('button', { name: 'Barrels', exact: false }).click()
  await page
    .getByLabel('Compare with', { exact: true })
    .selectOption('nautilus-3d')
  await expect(page).toHaveURL(/candidate=nautilus-3d/)
  await page.reload()
  await expect(page.getByLabel('Preference', { exact: true })).toHaveValue(
    'nautilus-3d',
  )
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Compare the edge depth.',
  )
  await expect(page.getByLabel('Compare with', { exact: true })).toHaveValue(
    'nautilus-3d',
  )
  source.conflict()
  await page
    .getByLabel('What works or needs changing?')
    .fill('Keep this draft after an error.')
  await page.getByRole('button', { name: 'Save review', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Reviews changed')
  await page.getByRole('button', { name: 'Reload saved reviews' }).click()
  await expect(
    page.getByText('Saved reviews reloaded. Your drafts are unchanged.'),
  ).toBeVisible()
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Keep this draft after an error.',
  )
  await page.getByRole('button', { name: 'Revert draft', exact: true }).click()
  await expect(page.getByLabel('What works or needs changing?')).toHaveValue(
    'Compare the edge depth.',
  )
  expect(errors).toEqual([])
})

test('matched scenes, old links, responsive views and hidden animation playback', async ({
  page,
}) => {
  await page.goto(
    '/resourcepacks/reviews-preview?location=authoring&feature=chest',
  )
  await expect(page).toHaveURL(/\/resourcepacks\/reviews\?feature=chest/)
  await expect(
    page.getByRole('heading', { name: 'Chests and Lootr', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'B · Pack authoring' }),
  ).toHaveCount(0)
  const buttons = page
    .getByRole('navigation', { name: 'Review features' })
    .getByRole('button')
  for (const button of await buttons.all()) {
    await button.click()
    for (const option of await page.locator('#comparison-scene option').all()) {
      await page
        .getByLabel('Scene', { exact: true })
        .selectOption(await option.getAttribute('value'))
      const images = page.locator('.image-comparison-canvas img')
      await expect(page.locator('.image-comparison-canvas')).toHaveAttribute(
        'data-ready',
        'true',
      )
      const sizes = await images.evaluateAll((nodes) =>
        nodes.map((node) => ({
          width: node.naturalWidth,
          height: node.naturalHeight,
          declaredWidth: Number(node.getAttribute('width')),
          declaredHeight: Number(node.getAttribute('height')),
        })),
      )
      expect(sizes[0]).toEqual(sizes[1])
      expect(sizes[0].width).toBeGreaterThan(0)
      expect(sizes[0].width).toBe(sizes[0].declaredWidth)
      expect(sizes[0].height).toBe(sizes[0].declaredHeight)
    }
  }
  await page.getByRole('button', { name: 'Chests and Lootr' }).click()
  const recordings = page.getByText('Closing animations · 8 recordings', {
    exact: true,
  })
  await recordings.click()
  const video = page.locator('video').first()
  await video.evaluate(async (node) => {
    node.muted = true
    await node.play()
  })
  await expect(video).toHaveJSProperty('paused', false)
  await recordings.click()
  await expect(video).toHaveJSProperty('paused', true)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
})

test('image reveal supports dragging, keyboard, fixed halves and touch without rescaling', async ({
  page,
  browser,
}) => {
  await page.goto('/resourcepacks/reviews')
  const canvas = page.locator('.image-comparison-canvas')
  const slider = page.getByRole('slider', { name: 'Reveal position' })
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  const bounds = await canvas.boundingBox()
  await page.mouse.move(
    bounds.x + bounds.width * 0.25,
    bounds.y + bounds.height * 0.25,
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width * 0.75,
    bounds.y + bounds.height * 0.25,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect(slider).toHaveValue('75')
  await slider.focus()
  await slider.press('Home')
  await expect(slider).toHaveValue('0')
  await slider.press('End')
  await expect(slider).toHaveValue('100')
  await slider.press('ArrowLeft')
  await expect(slider).toHaveValue('99')
  for (const [name, mode, clip] of [
    ['Vertical halves', 'vertical', 'inset(0px 0px 0px 50%)'],
    ['Horizontal halves', 'horizontal', 'inset(50% 0px 0px)'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(slider).toBeDisabled()
    await expect(slider).toHaveValue('50')
    await expect(canvas).toHaveAttribute('data-mode', mode)
    await expect(page.locator('.image-comparison-overlay')).toHaveCSS(
      'clip-path',
      clip,
    )
    const images = await canvas.locator('img').evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
      })),
    )
    expect(images[0]).toEqual(images[1])
    expect(images[0].width).toBeCloseTo(bounds.width, 0)
    await canvas.click({
      position: { x: bounds.width * 0.2, y: bounds.height * 0.2 },
    })
    await expect(slider).toHaveValue('50')
  }
  await page.getByRole('button', { name: 'Swipe', exact: true }).click()
  await expect(slider).toBeEnabled()
  await expect(slider).toHaveValue('99')
  const touchPage = await browser.newPage({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  })
  try {
    await touchPage.goto('/resourcepacks/reviews')
    const touchCanvas = touchPage.locator('.image-comparison-canvas')
    await expect(touchCanvas).toHaveAttribute('data-ready', 'true')
    await touchCanvas.scrollIntoViewIfNeeded()
    const touchBounds = await touchCanvas.boundingBox()
    await touchPage.touchscreen.tap(
      touchBounds.x + touchBounds.width * 0.25,
      touchBounds.y + touchBounds.height * 0.5,
    )
    await expect(
      touchPage.getByRole('slider', { name: 'Reveal position' }),
    ).toHaveValue('25')
  } finally {
    await touchPage.close()
  }
  await page.route('**/barrels-detail-classic-3d-barrels-plain.png', (route) =>
    route.abort(),
  )
  await page.goto('/resourcepacks/reviews?candidate=classic-3d')
  await expect(
    page.getByText('Capture unavailable. Try the original links.'),
  ).toBeVisible()
  await expect(canvas).toHaveAttribute('data-ready', 'false')
  await expect(canvas.locator('img').first()).toHaveCSS('visibility', 'hidden')
  await expect(
    page.getByRole('link', { name: 'Open original · D · Classic 3D' }),
  ).toBeVisible()
})
