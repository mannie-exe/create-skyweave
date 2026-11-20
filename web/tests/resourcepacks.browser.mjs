import { test, expect } from '@playwright/test'

// Keep interaction checks independent of external gallery availability.
// Source image URLs are checked separately during each catalog refresh.
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#dce3ef"/></svg>',
    }),
  )
})

test('comparison sheets link to their unedited originals', async ({ page }) => {
  await page.goto('/resourcepacks#3d-default')
  const gallery = page.locator('[id="3d-default"] [data-gallery]')
  await gallery.locator('[data-presentation="true"]').first().click()
  const originals = gallery.locator('[data-gallery-originals]')
  await expect(originals).toBeVisible()
  await expect(originals.locator('a')).toHaveCount(4)
  for (const link of await originals.locator('a').all()) {
    await expect(link).toHaveAttribute(
      'href',
      /\/generated\/resource-review\/selective-20261101\/.*\.png$/,
    )
  }
  await expect(gallery.locator('[data-gallery-source]')).toHaveText(
    'Open comparison sheet',
  )
  await gallery.locator('[data-image]').first().click()
  await expect(originals).toBeHidden()
})

test('review filters persist, reset and reveal catalog references', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/resourcepacks?decision=installed')
  const allCandidates = await page.locator('[data-candidate]').count()
  const selectedCandidates = await page
    .locator('[data-candidate][data-status="installed"]')
    .count()
  await expect(page.locator('[id="3d-ladders"]')).toBeHidden()
  await expect(page.locator('#icons')).toBeHidden()
  await expect(page.locator('#rays-3d-ladders .review-status')).toHaveText(
    'Selected stack',
  )
  await expect(page.locator('[data-candidate]:visible')).toHaveCount(
    selectedCandidates,
  )
  await expect(page.locator('#fresh-animations')).toBeVisible()
  await expect(page.locator('#fresh-animations-objects')).toBeVisible()
  await page.locator('#pack-search').fill('does not exist')
  await expect(page.locator('#pack-empty')).toBeVisible()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.locator('[data-candidate]:visible')).toHaveCount(
    allCandidates,
  )
  await page.locator('#pack-category').selectOption('Connected textures')
  await expect(page).toHaveURL(/scope=Connected/)
  await page.reload()
  await expect(page.locator('#pack-category')).toHaveValue('Connected textures')
  await page.locator('.catalog-screening summary').click()
  await page.locator('#catalog-search').fill("RAY's 3D Ladders")
  await expect(page.locator('[data-catalog-search]:visible')).toHaveCount(1)
  await page.locator('.catalog-screening a[href="#rays-3d-ladders"]').click()
  await expect(page.locator('#rays-3d-ladders')).toBeVisible()
  await expect(page.locator('#pack-category')).toHaveValue('')
  expect(errors).toEqual([])
})

test('current resource defaults show selected Fresh packs and unarchived selected files', async ({
  page,
}) => {
  await page.goto('/resourcepacks')
  const defaults = page.locator('#default-resource-stack')
  await defaults.locator('summary').click()
  await expect(
    defaults.locator('[data-resource-selection="fresh-animations"]'),
  ).toContainText('Enabled')
  await expect(
    defaults.locator('[data-resource-selection="fresh-animations-details"]'),
  ).toContainText('Enabled')
  await expect(
    defaults.locator('[data-resource-selection="fresh-animations"]'),
  ).toContainText('Matches locked source')
  await expect(
    defaults.locator('[data-resource-selection="fresh-animations-objects"]'),
  ).toContainText('Enabled')
  await expect(
    defaults.locator('[data-resource-selection="refined-tools"]'),
  ).toContainText('Enabled')
  await expect(
    defaults.locator('[data-resource-selection="refined-tools"]'),
  ).toContainText('Not archived')
})

test('gallery selection, keyboard viewer and responsive columns', async ({
  page,
}) => {
  await page.goto('/resourcepacks')
  const card = page.locator('[id="3d-default"][data-candidate]')
  const copy = card.locator('.candidate-copy')
  const gallery = card.locator('[data-gallery]')
  const choices = gallery.locator('[data-image]')
  const total = await choices.count()
  expect(total).toBeGreaterThanOrEqual(3)
  const before = await gallery.locator('.gallery-main').getAttribute('src')
  await choices.nth(1).click()
  await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(gallery.locator('.gallery-main')).not.toHaveAttribute(
    'src',
    before,
  )
  await gallery.locator('[data-open-image]').click()
  const viewer = page.getByRole('dialog')
  const expectMedia = async (index) => {
    const choice = choices.nth(index)
    const kind = await choice.getAttribute('data-kind')
    const source = await choice.getAttribute('data-image')
    expect(['image', 'video']).toContain(kind)
    expect(source).toBeTruthy()
    const media = viewer.locator(kind === 'video' ? 'video' : 'img')
    await expect(media).toBeVisible()
    await expect(media).toHaveAttribute('src', source)
  }
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('[data-viewer-caption]')).toContainText(
    `2 / ${total}`,
  )
  await expectMedia(1)
  await page.keyboard.press('ArrowRight')
  await expect(viewer.locator('[data-viewer-caption]')).toContainText(
    `3 / ${total}`,
  )
  await expectMedia(2)
  await page.keyboard.press('ArrowLeft')
  await expect(viewer.locator('[data-viewer-caption]')).toContainText(
    `2 / ${total}`,
  )
  await expectMedia(1)
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
  await expect(gallery.locator('[data-open-image]')).toBeFocused()
  let left = await copy.boundingBox(),
    right = await gallery.boundingBox()
  expect(right.x).toBeGreaterThan(left.x + left.width)
  await page.setViewportSize({ width: 390, height: 844 })
  left = await copy.boundingBox()
  right = await gallery.boundingBox()
  expect(right.y).toBeGreaterThan(left.y + left.height)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('failed remote images retain a source fallback', async ({ page }) => {
  await page.unroute(/^https:\/\//)
  await page.route(/^https:\/\//, (route) => route.abort())
  await page.goto('/resourcepacks')
  const gallery = page.locator('[data-gallery]').first()
  await expect(gallery.locator('[data-image-error]')).toBeVisible()
  await expect(
    gallery.getByRole('link', { name: 'Author’s source gallery' }),
  ).toHaveAttribute('href', /^https:/)
})

test('archived images and recordings retain attribution and stop hidden playback', async ({
  page,
}) => {
  await page.goto('/resourcepacks#better-lanterns')
  const gallery = page.locator('#better-lanterns [data-gallery]')
  const local = gallery.getByRole('group', { name: 'Create: Skyweave tests' })
  await local.locator('[data-kind="image"]').first().click()
  await expect(gallery.locator('[data-gallery-credit]')).toContainText(
    'Create: Skyweave test · 2026-10-24',
  )
  await expect(gallery.locator('figcaption [data-caption]')).toContainText(
    'Before',
  )
  await expect
    .poll(() =>
      gallery.locator('.gallery-main').evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  await local.locator('[data-kind="video"]').first().click()
  const video = gallery.locator('video')
  await expect(video).toBeVisible()
  await video.evaluate(async (video) => {
    video.muted = true
    await video.play()
  })
  await expect
    .poll(() => video.evaluate((video) => video.currentTime))
    .toBeGreaterThan(0)
  await gallery.getByRole('button', { name: 'Enlarge recording' }).click()
  await expect.poll(() => video.evaluate((video) => video.paused)).toBe(true)
  const viewer = page.locator('#image-viewer')
  await expect(viewer.locator('video')).toBeVisible()
  await viewer.locator('video').evaluate(async (video) => {
    video.muted = true
    await video.play()
  })
  await viewer.locator('[data-close]').click()
  await expect
    .poll(() => viewer.locator('video').evaluate((video) => video.paused))
    .toBe(true)
  await gallery
    .getByRole('group', { name: 'Author gallery' })
    .locator('button')
    .first()
    .click()
  await expect(video).toBeHidden()
  await expect(gallery.locator('[data-gallery-source]')).toHaveText(
    'Author’s source gallery',
  )
  await expect(gallery.locator('[data-gallery-credit]')).not.toContainText(
    '2026-10-24',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('pack-owned artifacts distinguish client resources from shared data', async ({
  page,
}) => {
  await page.goto('/resourcepacks?scope=Pack-owned')
  await expect(page.locator('[data-candidate]:visible')).toHaveCount(2)
  const patch = page.locator('#skyweave-visual-patches')
  const fixes = page.locator('#skyweave-resource-patches')
  await expect(patch.locator('.candidate-current')).toContainText(
    'Resource pack · Client',
  )
  await expect(fixes.locator('.candidate-current')).toContainText(
    'Resource-only mod · Client and server',
  )
  await expect(fixes.locator('[data-gallery]')).toHaveCount(0)
  await expect(patch.locator('[data-gallery-source]')).toHaveText(
    'Open original capture',
  )
  await patch.locator('.candidate-evidence > summary').click()
  await fixes.locator('.candidate-evidence > summary').click()
  await expect(patch.locator('.candidate-evidence')).toContainText(
    'Built artifact present.',
  )
  await expect(fixes.locator('.candidate-evidence')).toContainText(
    'Built artifact present.',
  )
  await expect(patch.locator('.candidate-evidence')).toContainText(
    'build-visual-patches.py --check',
  )
})

test('reading rail follows the document and shares its filters', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/resourcepacks?decision=installed')
  const index = page.getByRole('navigation', { name: 'Resource pack index' })
  const allCandidates = await page.locator('[data-candidate]').count()
  const selectedCandidates = await page
    .locator('[data-candidate][data-status="installed"]')
    .count()
  await expect(index.locator('a:visible')).toHaveCount(selectedCandidates)
  await index.locator('[href="#skyweave-resource-patches"]').click()
  await expect(page.locator('#skyweave-resource-patches h2')).toBeFocused()
  await expect(
    index.locator('[href="#skyweave-resource-patches"]'),
  ).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('[data-candidate]:visible')).toHaveCount(
    selectedCandidates,
  )
  await page
    .locator('#rays-3d-ladders')
    .evaluate((card) => card.scrollIntoView({ block: 'start' }))
  await expect(index.locator('[href="#rays-3d-ladders"]')).toHaveAttribute(
    'aria-current',
    'location',
  )
  // Reading changes location, not keyboard focus.
  await expect(page.locator('#skyweave-resource-patches h2')).toBeFocused()
  await page.locator('#pack-search').fill('missing pack xyz')
  await expect(page.locator('#pack-empty')).toBeVisible()
  await expect(index.locator('a:visible')).toHaveCount(0)
  await page.locator('#pack-reset').click()
  await expect(index.locator('a:visible')).toHaveCount(allCandidates)
  await page.setViewportSize({ width: 390, height: 844 })
  await index.locator('[href="#skyweave-visual-patches"]').click()
  await expect(page.locator('#skyweave-visual-patches h2')).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.locator('[data-resource-index-back]').click()
  await expect(index.locator('[href="#skyweave-visual-patches"]')).toBeFocused()
  expect(errors).toEqual([])
})

test('old preview links preserve filters and reveal their target on the adopted page', async ({
  page,
}) => {
  for (const layout of ['continuous', 'index']) {
    await page.goto(
      `/resources-preview?layout=${layout}&decision=installed#skyweave-visual-patches`,
    )
    await expect(page).toHaveURL(
      '/resourcepacks?decision=installed#skyweave-visual-patches',
    )
    const choice = page.locator(
      '#resource-index [href="#skyweave-visual-patches"]',
    )
    await expect(choice).toHaveAttribute('aria-current', 'location')
    await expect
      .poll(() =>
        choice.evaluate((link) => {
          const item = link.getBoundingClientRect(),
            index = link.parentElement.getBoundingClientRect()
          return item.top >= index.top && item.bottom <= index.bottom + 1
        }),
      )
      .toBe(true)
    await expect(page.locator('[data-candidate]:visible')).toHaveCount(
      await page.locator('[data-candidate][data-status="installed"]').count(),
    )
  }
  await page.goto('/resourcepacks?scope=Pack-owned#rays-3d-ladders')
  await expect(page.locator('#pack-category')).toHaveValue('')
  await expect(
    page.locator('#resource-index [href="#rays-3d-ladders"]'),
  ).toHaveAttribute('aria-current', 'location')
})
