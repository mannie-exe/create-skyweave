import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { auditDefinitions } from '../scripts/workspace/audit.ts'
import { createWorkspaceService } from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'

test('audit rejects changed policy, ownership tool or host template and retains prior evidence', async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-audit-')),
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    pack: root,
    web: root,
  }
  const inputs = [
    'empack.bindings.yml',
    'scripts/village_outputs.py',
    'templates/server/game/user_jvm_args.txt.template',
  ]
  for (const name of inputs) {
    const file = path.join(root, name)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, 'original\n')
  }
  const report = { records: [], unregistered: [], generated: [] }
  let service, changed
  const artifacts = createArtifactStore({
    root: path.join(root, '.cache/artifacts'),
    registrations: [registration],
    can: (context, grant) => service.can(context, grant),
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: auditDefinitions(
      {
        available() {},
        async run() {
          if (changed)
            await fs.appendFile(
              path.join(root, changed),
              'changed during audit\n',
            )
          return { stdout: JSON.stringify(report) }
        },
      },
      artifacts,
    ),
  })
  t.after(async () => {
    await service.dispose()
    await artifacts.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  const actor = {
    principal: { kind: 'anonymous', id: 'fixture' },
    connectionId: randomUUID(),
  }
  const run = async () =>
    (
      await service.submit(actor, {
        v: 1,
        type: 'command',
        requestId: randomUUID(),
        commandId: randomUUID(),
        session: service.session,
        createdAt: new Date().toISOString(),
        scope: registration.scope,
        operation: 'config.audit',
        payload: {},
      })
    ).outcome
  const first = await run()
  assert.equal(first.operation.state, 'succeeded')
  const previous = first.payload
  for (const name of inputs) {
    changed = name
    const result = await run()
    assert.equal(result.error?.code, 'REVISION_CONFLICT', name)
    const evidence = await artifacts.resolve(
      actor,
      registration.scope,
      previous.id,
    )
    assert.deepEqual(
      JSON.parse(await fs.readFile(evidence.file, 'utf8')),
      report,
    )
  }
})
