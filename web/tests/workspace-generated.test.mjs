import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createGeneratedInputs } from '../scripts/workspace/generated.ts'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'

test(
  'generated input publication guards concurrent reads, rolls back ordinary failure and preserves external edits',
  { timeout: 10000 },
  async (t) => {
    const root = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-generated-')),
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
    const generated = path.join(root, 'data/generated')
    await fs.mkdir(generated, { recursive: true })
    await fs.writeFile(path.join(generated, 'a.json'), '{"version":"old"}')
    await fs.writeFile(
      path.join(generated, 'world.json'),
      '{"survey":"preserved"}',
    )
    const store = createGeneratedInputs(registration)
    const installed = Promise.withResolvers(),
      publish = Promise.withResolvers(),
      reading = Promise.withResolvers(),
      releaseRead = Promise.withResolvers()
    let holdRead = false
    const service = createWorkspaceService({
      registrations: [registration],
      definitions: [
        defineOperation({
          name: 'fixture.read',
          effect: 'query',
          input: z.strictObject({}),
          output: z.unknown(),
          label: 'Read',
          href: '/',
          success: '',
          targets: () => [],
          execute: async () => {
            const value = JSON.parse(
              await fs.readFile(path.join(generated, 'a.json'), 'utf8'),
            )
            if (holdRead) {
              reading.resolve()
              await releaseRead.promise
            }
            return value
          },
        }),
        defineOperation({
          name: 'fixture.generate',
          effect: 'generate',
          input: z.strictObject({
            mode: z.enum(['success', 'fail', 'external', 'stale']),
          }),
          output: z.unknown(),
          label: 'Generate',
          href: '/',
          success: 'Published',
          targets: () => [],
          execute: async (ctx, { mode }) => {
            const before = await store.inventory()
            const stage = await fs.mkdtemp(path.join(root, 'candidate-'))
            try {
              await store.copy(before, stage)
              await fs.writeFile(
                path.join(stage, 'a.json'),
                '{"version":"new"}',
              )
              if (mode === 'stale')
                await fs.writeFile(
                  path.join(generated, 'a.json'),
                  '{"external":"before"}',
                )
              return await store.replace(ctx, stage, before, async () => {
                if (mode === 'success') {
                  installed.resolve()
                  await publish.promise
                  return { published: true }
                }
                if (mode === 'external')
                  await fs.writeFile(
                    path.join(generated, 'a.json'),
                    '{"external":"during"}',
                  )
                throw new Error('Publisher failed')
              })
            } finally {
              await fs.rm(stage, { recursive: true, force: true })
            }
          },
        }),
      ],
    })
    t.after(async () => {
      releaseRead.resolve()
      publish.resolve()
      await service.dispose()
      await fs.rm(root, { recursive: true, force: true })
    })
    const read = () =>
      service.query(actor, registration.scope, 'fixture.read', {})
    const command = (mode) =>
      service.submit(actor, {
        v: 1,
        type: 'command',
        requestId: randomUUID(),
        commandId: randomUUID(),
        session: service.session,
        createdAt: new Date().toISOString(),
        scope: registration.scope,
        operation: 'fixture.generate',
        payload: { mode },
      })
    holdRead = true
    const oldRead = read().then(
      () => null,
      (error) => error.code,
    )
    await reading.promise
    const admitted = await command('success')
    await Promise.race([
      installed.promise,
      admitted.outcome.then((outcome) => {
        throw new Error(
          outcome.error?.message ?? 'Publication ended before barrier',
        )
      }),
    ])
    await assert.rejects(read(), { code: 'BUSY' })
    assert.equal(
      (await service.activity(actor, registration.scope)).current.id,
      admitted.operation.id,
    )
    releaseRead.resolve()
    assert.equal(await oldRead, 'BUSY')
    holdRead = false
    publish.resolve()
    const result = await admitted.outcome
    assert.equal(result.operation.state, 'succeeded', result.error?.message)
    assert.ok(
      result.operation.stages.some((stage) => stage.name === 'snapshot-inputs'),
    )
    assert.deepEqual(await read(), { version: 'new' })
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(generated, 'world.json'), 'utf8')),
      { survey: 'preserved' },
    )
    await fs.writeFile(
      path.join(generated, 'a.json'),
      '{"version":"before failure"}',
    )
    const failure = await (await command('fail')).outcome
    assert.equal(failure.operation.state, 'failed')
    assert.deepEqual(await read(), { version: 'before failure' })
    assert.deepEqual(failure.operation.stages, [])
    const stale = await (await command('stale')).outcome
    assert.equal(stale.error.code, 'REVISION_CONFLICT')
    assert.deepEqual(await read(), { external: 'before' })
    const external = await (await command('external')).outcome
    assert.equal(external.error.code, 'SOURCE_PARTIAL')
    assert.deepEqual(await read(), { external: 'during' })
    const transactions = path.join(
      root,
      '.cache/workspace/local/fixture/transactions',
    )
    const retained = await fs.readdir(transactions)
    assert.equal(retained.length, 1)
    const backup = JSON.parse(
      await fs.readFile(
        path.join(transactions, retained[0], 'generated/a.json'),
        'utf8',
      ),
    )
    assert.deepEqual(backup, { external: 'before' })
  },
)
