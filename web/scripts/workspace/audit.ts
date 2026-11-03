import { operationStaging, disposeStaging } from './staging.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { artifactSchema } from '../../src/lib/workspace/contracts.ts'
import { defineOperation, type Resolved } from './service.ts'
import { artifactRead, target } from './policy.ts'
import { hash, canonical } from './identity.ts'
import { WorkspaceError } from './errors.ts'
import type { NativeExecutor } from './native.ts'
import type { createArtifactStore } from './artifacts.ts'

const folders = [
  'authoring/changes',
  'overrides/common/config',
  'overrides/client/config',
  'overrides/server/config',
  'overrides/client/shaderpacks',
  'pack-fixes/data',
]
async function inventory(context: Resolved) {
  const root = await fs.realpath(context.registration.pack),
    result: Record<string, string> = {}
  async function visit(relative: string) {
    const file = path.join(root, relative)
    let info
    try {
      info = await fs.lstat(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (info.isSymbolicLink() || (await fs.realpath(file)) !== file)
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Audit input symlinks are not supported',
      )
    if (info.isDirectory())
      for (const name of await fs.readdir(file))
        await visit(relative + '/' + name)
    else if (info.isFile()) {
      if (Object.keys(result).length >= 2000 || info.size > 32 * 1024 * 1024)
        throw new WorkspaceError(
          'CAPACITY_REACHED',
          'Configuration audit exceeds its input limits',
        )
      result['config:' + relative] = file
    }
  }
  for (const folder of folders) await visit(folder)
  for (const file of [
    'overrides/client/options.txt',
    'templates/server/game/server.properties.template',
    'scripts/audit-changes.py',
  ])
    await visit(file)
  return result
}
async function vector(context: Resolved) {
  const result: Record<string, string> = {}
  let bytes = 0
  for (const [id, file] of Object.entries(await inventory(context)).sort()) {
    const content = await fs.readFile(file)
    bytes += content.byteLength
    if (bytes > 64 * 1024 * 1024)
      throw new WorkspaceError(
        'CAPACITY_REACHED',
        'Configuration audit exceeds 64 MiB',
      )
    result[id] = hash(content)
  }
  return result
}
export function auditDefinitions(
  native: NativeExecutor,
  artifacts: ReturnType<typeof createArtifactStore>,
) {
  return [
    defineOperation({
      name: 'config.audit',
      effect: 'inspect',
      input: z.strictObject({}),
      output: artifactSchema,
      resultTargets: (_ctx, value) => [artifactRead(value)],
      label: 'Check config files',
      href: '/authoring?view=audit',
      success: 'Config files checked.',
      async targets(ctx) {
        return [
          {
            action: 'preview.run' as const,
            target: target(ctx.scope, 'projection', 'config-audit'),
          },
          ...Object.keys(await inventory(ctx)).map((id) => ({
            action: 'source.read' as const,
            target: target(ctx.scope, 'source', id),
          })),
        ]
      },
      inputs: vector,
      available: () => native.available(),
      async execute(context) {
        const recheck = async () => {
          if (
            canonical(await vector(context)) !==
            canonical(context.inputRevisions)
          )
            throw new WorkspaceError(
              'REVISION_CONFLICT',
              'Configuration inputs changed during the audit',
              'after-refresh',
            )
          await context.authorize()
        }
        await recheck()
        const report = JSON.parse(
          (await native.run(context, 'config.audit')).stdout,
        )
        if (
          !Array.isArray(report.records) ||
          !Array.isArray(report.unregistered)
        )
          throw new WorkspaceError(
            'GENERATION_FAILED',
            'Audit report is incomplete',
          )
        const directory = await operationStaging(context, 'audit')
        try {
          const file = path.join(directory, 'audit.json')
          await fs.writeFile(file, JSON.stringify(report))
          const published = await artifacts.publish(context, {
            namespace: 'config-audit',
            staging: directory,
            files: { 'audit.json': file },
            inputs: { ...context.inputRevisions },
            recheck,
          })
          return published.files['audit.json']
        } finally {
          await disposeStaging(context, directory)
        }
      },
    }),
  ]
}
