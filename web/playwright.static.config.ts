import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.static.mjs',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4323',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'pnpm preview --port 4323 --ignore-lock',
    url: 'http://127.0.0.1:4323',
    reuseExistingServer: false,
  },
})
