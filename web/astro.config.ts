import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import { workspace } from './scripts/workspace.mjs'
import { staticSnapshot } from './scripts/static-snapshot.mjs'
import { domains } from './src/lib/domains.mjs'
export default defineConfig({
  output: 'static',
  integrations: [
    react(),
    staticSnapshot({ projections: ['map', 'objects', 'texture-resources'] }),
  ],
  server: { host: '127.0.0.1', port: 4321 },
  vite: {
    plugins: [workspace()],
    build: { assetsInlineLimit: 0 },
    // Workspace saves explicitly refresh their projection. Thousands of generated
    // writes must not trigger reloads that discard the active editor/view.
    server: {
      fs: {
        // Retain the reviewed Vite 8 defaults when extending this list.
        // Node adapters read private inputs directly; browser module URLs must not.
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key,p12,pfx,cer,der}',
          '.npmrc',
          '.yarnrc.yml',
          '**/.git/**',
          '**/.cache/**',
          '**/data/local.json',
          '**/data/generated/**',
          '**/public/generated/**',
        ],
      },
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
