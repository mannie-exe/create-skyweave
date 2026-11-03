import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicProjectionHeads } from './workspace/public-read.ts'
import { materializeStatic } from './workspace/static.ts'
import { createWorkspaceInventory } from './workspace/inventory.ts'
import { configuredPack } from './configuration.mjs'
import { canonical } from './workspace/identity.ts'
import { admitDelivery, openPolicy } from './workspace/policy.ts'

/** Build-only integration; never starts a workspace service, watcher or native job. */
export function staticSnapshot(options) {
  admitDelivery('open-static', options.policy ?? openPolicy)
  let web, registration, revision, expectedHeads
  const inventory = createWorkspaceInventory()
  return {
    name: 'atlas-public-workspace-snapshot',
    hooks: {
      'astro:config:done': ({ config }) => {
        web = fileURLToPath(config.root)
      },
      'astro:build:start': async () => {
        registration = {
          scope: { workspaceId: 'local', packId: 'create_sky' },
          web: path.resolve(web),
          pack: await configuredPack(web),
        }
        revision = canonical(await inventory.scan(registration))
        expectedHeads = await publicProjectionHeads(
          registration,
          options.projections,
        )
      },
      'astro:build:done': async ({ dir }) => {
        await materializeStatic({
          registration,
          output: fileURLToPath(dir),
          namespaces: options.projections,
          expectedHeads,
          policy: options.policy,
          recheck: async () => {
            if (canonical(await inventory.scan(registration)) !== revision)
              throw new Error(
                'Workspace sources changed during the static build; build again.',
              )
          },
        })
      },
    },
  }
}
