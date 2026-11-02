import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import { workspace } from './scripts/workspace.mjs'
import { domains } from './src/lib/domains.mjs'
export default defineConfig({
  output: 'static',
  integrations: [react()],
  server: { host: '127.0.0.1', port: 4321 },
  vite: {
    plugins: [workspace()],
    build: { assetsInlineLimit: 0 },
    // Workspace saves explicitly refresh their projection. Thousands of generated
    // writes must not trigger reloads that discard the active editor/view.
    server: {
      watch: {
        ignored: [
          '**/.cache/**',
          '**/data/generated/**',
          '**/data/local.json',
          '**/data/authored/resource-reviews.json',
          '**/public/generated/**',
          ...domains.map((domain) => `**/data/authored/${domain}.yml`),
        ],
      },
    },
  },
})
