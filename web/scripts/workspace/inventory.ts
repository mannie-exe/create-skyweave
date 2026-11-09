import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import { sourceIdentity } from './files.ts'
import { canonical, hash } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import {
  defineOperation,
  type Execution,
  type Registration,
} from './service.ts'
import { target, type Grant } from './policy.ts'
import { digestSchema } from '../../src/lib/workspace/contracts.ts'
import type { createArtifactStore } from './artifacts.ts'

export const projectionNamespaces = [
  'map',
  'scenario',
  'config-audit',
  'quests-preview',
  'models-preview',
  'resource-build',
  'texture-resources',
  'object-inputs',
  'native-models',
  'objects',
  'objects-preview',
] as const
export type InventoryEntry = {
  id: string
  kind: 'source' | 'input' | 'tool'
  revision: string
  writable: boolean
}
type Root = { owner: 'web' | 'pack'; relative: string; tree?: boolean }
// These are input declarations and text sources, never installed worlds, caches,
// dependency archives, preview images, or generated staging directories.
const roots: Root[] = [
  { owner: 'pack', relative: 'empack.yml' },
  { owner: 'pack', relative: 'empack.lock' },
  { owner: 'pack', relative: 'empack.bindings.yml' },
  { owner: 'pack', relative: 'authoring', tree: true },
  { owner: 'pack', relative: 'overrides/common/config', tree: true },
  { owner: 'pack', relative: 'overrides/common/defaultconfigs', tree: true },
  { owner: 'pack', relative: 'overrides/client/config', tree: true },
  { owner: 'pack', relative: 'overrides/client/options.txt' },
  { owner: 'pack', relative: 'overrides/server/config', tree: true },
  { owner: 'pack', relative: 'overrides/server/defaultconfigs', tree: true },
  {
    owner: 'pack',
    relative: 'templates/server/game/server.properties.template',
  },
  { owner: 'pack', relative: 'scripts', tree: true },
  { owner: 'pack', relative: 'resource-patches', tree: true },
  { owner: 'web', relative: 'data/authored', tree: true },
  { owner: 'web', relative: 'data/research/resourcepacks/local-media.json' },
  ...['catalog', 'projects', 'local-projects', 'object-projects'].map(
    (name) => ({
      owner: 'web' as const,
      relative: `data/research/resourcepacks/${name}.json`,
    }),
  ),
  { owner: 'web', relative: 'data/generated/runtime/snapshot.json' },
  ...['world', 'structures', 'islands'].map((relative) => ({
    owner: 'web' as const,
    relative: `data/generated/${relative}.json`,
  })),
  { owner: 'web', relative: 'config', tree: true },
  { owner: 'web', relative: 'data/local.json' },
  { owner: 'web', relative: 'data/local.example.json' },
  { owner: 'web', relative: 'profiles', tree: true },
  { owner: 'web', relative: 'scripts', tree: true },
  { owner: 'web', relative: 'tools', tree: true },
  ...['package.json', 'pnpm-lock.yaml', 'astro.config.ts'].map((relative) => ({
    owner: 'web' as const,
    relative,
  })),
  ...['domains.mjs', 'resource-comparisons.mjs', 'workspace/contracts.ts'].map(
    (name) => ({ owner: 'web' as const, relative: `src/lib/${name}` }),
  ),
]
const extensions =
  /\.(?:json|json5|snbt|yml|yaml|toml|properties|cfg|conf|txt|py|mjs|ts|java|png|mcmeta)$/
const ignoredSegment = /^(?:\..*|node_modules|__pycache__|build|dist|target)$/
export function inventoryRoots(registration: Registration) {
  return roots.map((root) => ({
    ...root,
    file: path.join(registration[root.owner], root.relative),
  }))
}
export function inventoryAccepts(
  registration: Registration,
  file: string,
  directory = false,
) {
  return inventoryRoots(registration).some((root) => {
    if (file === root.file) return true
    if (!root.tree || !file.startsWith(root.file + path.sep)) return false
    if (
      root.owner === 'pack' &&
      file ===
        path.join(
          registration.pack,
          'overrides/common/config/ftbquests/quests/.skyweave-generated.json',
        )
    )
      return true
    const parts = path.relative(root.file, file).split(path.sep)
    if (parts.some((part) => ignoredSegment.test(part) || part.endsWith('~')))
      return false
    return directory || extensions.test(file)
  })
}
export const sourceReadGrant = (
  registration: Registration,
  id: string,
): Grant => ({
  action: 'source.read',
  target: target(registration.scope, 'source', id),
})
const entrySchema = z.strictObject({
  id: z.string().max(240),
  kind: z.enum(['source', 'input', 'tool']),
  revision: digestSchema,
  writable: z.boolean(),
})
const inventorySchema = z.strictObject({
  entries: z.array(entrySchema).max(8000),
  revision: digestSchema,
  monitoring: z.enum(['starting', 'ready', 'degraded']),
  restartRequired: z.boolean(),
})
export type Inventory = z.infer<typeof inventorySchema>

/** A bounded metadata inventory. Policy is applied before file reads and aggregation. */
export function createWorkspaceInventory() {
  const cache = new Map<string, { stamp: string; revision: string }>()
  async function scan(
    registration: Registration,
    can: (grant: Grant) => Promise<boolean> = async () => true,
  ) {
    const entries: InventoryEntry[] = []
    let count = 0,
      bytes = 0
    for (const root of inventoryRoots(registration)) {
      async function visit(file: string) {
        let stat
        try {
          stat = await fs.lstat(file, { bigint: true })
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
          throw error
        }
        if (stat.isSymbolicLink()) return
        if (stat.isDirectory()) {
          if (!root.tree || !inventoryAccepts(registration, file, true)) return
          for (const entry of (await fs.readdir(file)).sort())
            await visit(path.join(file, entry))
          return
        }
        if (!stat.isFile() || !inventoryAccepts(registration, file)) return
        // Check intermediate directories too: a registered root itself may have
        // been replaced through a parent symlink after the watcher started.
        if ((await fs.realpath(file)) !== file) return
        const relative = path
          .relative(registration[root.owner], file)
          .split(path.sep)
          .join('/')
        const source = sourceIdentity(root.owner, relative)
        const tool =
          /^(?:scripts|tools|src\/lib)\//.test(relative) ||
          (root.owner === 'web' &&
            ['package.json', 'pnpm-lock.yaml', 'astro.config.ts'].includes(
              relative,
            ))
        const id =
          source?.id ?? `${tool ? 'tool' : 'input'}:${root.owner}/${relative}`
        if (id.length > 240)
          throw new WorkspaceError(
            'CAPACITY_REACHED',
            'Source identifier exceeds its limit',
          )
        if (!(await can(sourceReadGrant(registration, id)))) return
        if (++count > 8000 || stat.size > 16n * 1024n * 1024n)
          throw new WorkspaceError(
            'CAPACITY_REACHED',
            'Source inventory exceeds its limit',
            'after-refresh',
          )
        bytes += Number(stat.size)
        if (bytes > 128 * 1024 * 1024)
          throw new WorkspaceError(
            'CAPACITY_REACHED',
            'Source inventory exceeds its limit',
          )
        const stamp = `${stat.dev}/${stat.ino}/${stat.size}/${stat.mtimeNs}/${stat.ctimeNs}`
        let revision =
          cache.get(file)?.stamp === stamp
            ? cache.get(file)!.revision
            : undefined
        if (!revision) {
          const digest = createHash('sha256')
          for await (const chunk of createReadStream(file)) digest.update(chunk)
          const after = await fs.lstat(file, { bigint: true })
          if (
            `${after.dev}/${after.ino}/${after.size}/${after.mtimeNs}/${after.ctimeNs}` !==
            stamp
          )
            throw new WorkspaceError(
              'BUSY',
              'Source changed during inventory; retry shortly.',
              'after-idle',
            )
          revision = digest.digest('hex')
          cache.set(file, { stamp, revision })
        }
        entries.push({
          id,
          revision,
          kind: source ? 'source' : tool ? 'tool' : 'input',
          writable: source?.writable ?? false,
        })
      }
      await visit(root.file)
    }
    entries.sort((a, b) => a.id.localeCompare(b.id, 'en'))
    if (cache.size > 16000) cache.clear()
    return { entries, revision: hash(canonical(entries)) }
  }
  return { scan }
}

export function inventoryDefinitions(
  inventory: ReturnType<typeof createWorkspaceInventory>,
  artifacts: ReturnType<typeof createArtifactStore>,
  status: (
    registration: Registration,
  ) => Pick<Inventory, 'monitoring' | 'restartRequired'>,
) {
  return [
    defineOperation({
      name: 'sources.inventory',
      effect: 'query',
      input: z.strictObject({}),
      output: inventorySchema,
      label: 'Read source revisions',
      href: '/',
      success: '',
      targets: () => [],
      resultTargets: (ctx, value) =>
        value.entries.map((entry) =>
          sourceReadGrant(ctx.registration, entry.id),
        ),
      async execute(ctx) {
        return {
          ...(await inventory.scan(ctx.registration, ctx.can)),
          ...status(ctx.registration),
        }
      },
    }),
    defineOperation({
      name: 'projections.inventory',
      effect: 'query',
      input: z.strictObject({}),
      output: z.strictObject({
        entries: z
          .array(
            z.strictObject({
              namespace: z.enum(projectionNamespaces),
              generationId: z.uuid(),
              inputRevision: digestSchema,
              publishedAt: z.iso.datetime(),
            }),
          )
          .max(projectionNamespaces.length),
        revision: digestSchema,
      }),
      label: 'Read generated revisions',
      href: '/',
      success: '',
      targets: () => [],
      resultTargets: (ctx, value) =>
        value.entries.map((entry) => ({
          action: 'artifact.read' as const,
          target: target(ctx.scope, 'projection', entry.namespace),
        })),
      async execute(ctx: Execution) {
        const entries = []
        for (const namespace of projectionNamespaces) {
          if (
            !(await ctx.can({
              action: 'artifact.read',
              target: target(ctx.scope, 'projection', namespace),
            }))
          )
            continue
          const active = await artifacts.active(ctx, ctx.scope, namespace, '')
          if (active)
            entries.push({
              namespace,
              generationId: active.id,
              inputRevision: active.inputRevision,
              publishedAt: active.publishedAt,
            })
        }
        return { entries, revision: hash(canonical(entries)) }
      },
    }),
  ]
}
