import { test, expect } from '@playwright/test'

test('old Lootr study link opens the texture catalogue', async ({ page }) => {
  await page.goto('/lootr-artwork-preview')
  await expect(page).toHaveURL(/resource-authoring\?view=textures/)
  await expect(page.locator('#texture-list button')).toHaveCount(4)
})
