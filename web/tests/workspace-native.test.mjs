import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { target } from '../scripts/workspace/policy.ts'

test('native cancellation retains committed source; shutdown stops owned noncancellable workers and redacts paths', async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-native-')),
  )
  await fs.mkdir(path.join(root, 'scripts'))
  await fs.writeFile(
    path.join(root, 'scripts/generate-journal.py'),
    "import sys,time\nfrom pathlib import Path\nprint(str(Path.cwd())+'/private-marker',file=sys.stderr,flush=True)\ntime.sleep(30)\n",
  )
  const registration = {
    scope: { workspaceId: 'local', packId: 'fixture' },
    web: root,
    pack: root,
  }
  const actor = {
    principal: { kind: 'anonymous', id: 'local-open' },
    connectionId: randomUUID(),
  }
  const runner = createJobRunner({
    'fixture.wait': {
      ...jobRegistry['journal.preview'],
      args: [],
      cancellable: true,
    },
    'fixture.publish': {
      ...jobRegistry['journal.preview'],
      args: [],
      cancellable: false,
    },
  })
  let service
  const native = createNativeExecutor({
    runner,
    session: () => service.session,
  })
  service = createWorkspaceService({
    registrations: [registration],
    shutdown: () => native.dispose(),
    definitions: [
      defineOperation({
        name: 'fixture.save',
        effect: 'source-write',
        input: z.strictObject({ publish: z.boolean() }),
        output: z.unknown(),
        label: 'Fixture',
        href: '/',
        success: 'Saved',
        targets: () => [],
        async execute(ctx, input) {
          await ctx.authorize()
          await fs.writeFile(path.join(root, 'saved.txt'), 'saved')
          ctx.committed('source')
          return native.run(
            ctx,
            input.publish ? 'fixture.publish' : 'fixture.wait',
          )
        },
      }),
      defineOperation({
        name: 'operation.cancel',
        effect: 'control',
        input: z.strictObject({ id: z.uuid() }),
        output: z.unknown(),
        label: 'Cancel',
        href: '/',
        success: 'Requested',
        targets: (ctx, input) => [
          {
            action: 'operation.cancel',
            target: target(ctx.scope, 'operation', input.id),
          },
        ],
        execute: (ctx, input) => native.cancel(ctx, input.id),
      }),
    ],
  })
  t.after(async () => {
    await service.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  const submit = (operation, payload) =>
    service.submit(actor, {
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
  async function ready() {
    for (let index = 0; index < 100; index++) {
      const current = (await service.activity(actor, registration.scope))
        .current
      if (current?.job?.diagnostic) return current
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error('Worker did not report ready')
  }
  const first = await submit('fixture.save', { publish: false })
  const current = await ready()
  assert.match(current.job.diagnostic, /\[workspace\]/)
  assert.ok(!current.job.diagnostic.includes(root))
  await (
    await submit('operation.cancel', { id: current.id })
  ).outcome
  const cancelled = await first.outcome
  assert.equal(cancelled.operation.state, 'cancelled')
  assert.equal(cancelled.operation.stages[0].committed, true)
  assert.equal(await fs.readFile(path.join(root, 'saved.txt'), 'utf8'), 'saved')
  const second = await submit('fixture.save', { publish: true })
  assert.equal((await ready()).job.cancellable, false)
  const pid = runner.ownedProcess().pid
  await service.dispose()
  assert.equal((await second.outcome).operation.state, 'unknown')
  assert.throws(
    () => process.kill(pid, 0),
    (error) => error.code === 'ESRCH',
  )
  assert.deepEqual(
    await fs.readdir(
      path.join(root, '.cache/workspace/local/fixture/processes'),
    ),
    [],
  )
})
