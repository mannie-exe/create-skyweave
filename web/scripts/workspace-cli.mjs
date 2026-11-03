import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createWorkspaceRuntime } from './workspace/runtime.ts'
import { configuredPack } from './configuration.mjs'
import { WorkspaceError } from './workspace/errors.ts'

/** Trusted local CLI uses the same definitions, bounds and publication as the app. */
export async function withWorkspace(web, work) {
  const runtime = createWorkspaceRuntime({
    web,
    pack: await configuredPack(web),
  })
  const actor = {
    principal: { kind: 'anonymous', id: 'local-cli' },
    connectionId: randomUUID(),
  }
  let disposing
  const dispose = () => (disposing ??= runtime.dispose())
  const interrupt = (signal) => {
    process.exitCode = signal === 'SIGINT' ? 130 : 143
    void dispose()
  }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  try {
    return await work({
      query: (operation, payload = {}) =>
        runtime.service.query(actor, runtime.scope, operation, payload),
      async command(operation, payload) {
        const admitted = await runtime.service.submit(actor, {
          v: 1,
          type: 'command',
          requestId: randomUUID(),
          commandId: randomUUID(),
          session: runtime.service.session,
          createdAt: new Date().toISOString(),
          scope: runtime.scope,
          operation,
          payload,
        })
        const outcome = await admitted.outcome
        if (outcome.error)
          throw new WorkspaceError(
            outcome.error.code,
            outcome.error.message,
            outcome.error.recovery,
          )
        return outcome.payload
      },
      async projection(namespace, name) {
        const reference = await runtime.service.query(
          actor,
          runtime.scope,
          'projection.read',
          { namespace, name },
        )
        return (
          await runtime.artifacts.resolve(actor, runtime.scope, reference.id)
        ).file
      },
    })
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    await dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).join(' ') !== 'map.compile')
    throw new Error('Use workspace-cli.mjs map.compile')
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  try {
    await withWorkspace(web, async (workspace) => {
      const source = await workspace.query('map.sources.read')
      const result = await workspace.command('map.compile', {
        revision: source.revision,
      })
      console.log(
        `Map published: ${result.generationId} (inputs ${result.inputRevision})`,
      )
    })
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Map compilation failed',
    )
    process.exitCode ||= 1
  }
}
