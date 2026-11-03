import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import { journalDefinitions } from '../scripts/workspace/journal.ts'
import { modelDefinitions } from '../scripts/workspace/models.ts'

// Test-only conveniences delegate to the shipping service; reads never launch previews.
export function domainFixture(t, root, kind, runner) {
  const registration = {
      scope: { workspaceId: 'local', packId: 'fixture' },
      web: root,
      pack: root,
    },
    actor = {
      principal: { kind: 'anonymous', id: 'fixture' },
      connectionId: randomUUID(),
    }
  let service
  const native = createNativeExecutor({
      session: () => service.session,
      runner,
    }),
    artifacts = createArtifactStore({
      root: path.join(root, '.cache/workspace/artifacts'),
      registrations: [registration],
      can: (context, grant) => service.can(context, grant),
    })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: (kind === 'journal' ? journalDefinitions : modelDefinitions)(
      [registration],
      native,
      artifacts,
    ),
    shutdown: () => native.dispose(),
  })
  t.after(async () => {
    await service.dispose()
    await artifacts.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  async function command(operation, payload) {
    const admitted = await service.submit(actor, {
      v: 1,
      type: 'command',
      requestId: randomUUID(),
      commandId: randomUUID(),
      session: service.session,
      createdAt: new Date().toISOString(),
      scope: registration.scope,
      operation,
      payload,
    })
    const result = await admitted.outcome
    if (result.error)
      throw Object.assign(new Error(result.error.message), result.error)
    return result.payload
  }
  return {
    read: () => service.query(actor, registration.scope, kind + '.read', {}),
    save: (input) =>
      command(kind === 'journal' ? 'journal.save' : 'models.save', input),
    generate: (input) =>
      command(
        kind === 'journal' ? 'journal.generate' : 'resources.generate',
        input,
      ),
    preview: (input) =>
      command(
        kind + '.preview',
        kind === 'journal' ? { revision: input } : { document: input },
      ),
    async artifactJSON(reference) {
      const value = await artifacts.resolve(
        actor,
        registration.scope,
        reference.id,
      )
      return JSON.parse(await fs.readFile(value.file, 'utf8'))
    },
  }
}
