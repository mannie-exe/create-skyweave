import { defineConfig } from '@playwright/test'

const port = Number(process.env.ATLAS_TEST_PORT ?? 4322)
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('ATLAS_TEST_PORT must be an integer from 1024 to 65535')
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.mjs',
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `pnpm dev --port ${port} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
