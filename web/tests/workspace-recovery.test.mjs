import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { recoveryDefinitions } from '../scripts/workspace/recovery.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import {
  operationStaging,
  disposeStaging,
} from '../scripts/workspace/staging.ts'
import { operationOwner } from '../scripts/workspace/ownership.ts'

const actor = {
  principal: { kind: 'anonymous', id: 'local' },
  connectionId: randomUUID(),
}
async function deadProcess() {
  const child = spawn(process.execPath, ['-e', ''], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  })
  const pid = child.pid
  await once(child, 'close')
  return pid
}
async function fixture(t, multiple = false) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-recovery-')),
  )
  await fs.mkdir(path.join(root, 'data/authored'), { recursive: true })
  await fs.writeFile(
    path.join(root, 'data/authored/recipes.yml'),
    'schema: 1\nchanges: []\n',
  )
  const scopes = ['alpha', 'beta'].map((packId) => ({
      workspaceId: 'local',
      packId,
    })),
    registrations = (multiple ? scopes : scopes.slice(0, 1)).map((scope) => ({
      scope,
      web: root,
      pack: root,
    }))
  let service,
    last,
    held,
    deny = () => false
  const artifacts = createArtifactStore({
    root: path.join(root, '.cache/workspace/artifacts'),
    registrations,
    can: (ctx, grant) => service.can(ctx, grant),
  })
  service = createWorkspaceService({
    registrations,
    policy: {
      mode: 'restricted',
      decide(_ctx, action, target) {
        return { allowed: !deny(action, target) }
      },
    },
    definitions: [
      ...recoveryDefinitions(registrations, {
        can: (ctx, grant) => service.can(ctx, grant),
        session: () => service.session,
        running: (scope, id) => service.operationRunning(scope, id),
        artifacts,
      }),
      defineOperation({
        name: 'fixture.stage',
        effect: 'preview',
        input: z.strictObject({
          hold: z.boolean().default(false),
          dispose: z.boolean().default(false),
        }),
        output: z.boolean(),
        label: 'Staging fixture',
        href: '/',
        success: '',
        targets: () => [],
        async execute(ctx, input) {
          const directory = await operationStaging(ctx, 'fixture')
          last = { directory, ctx }
          await fs.writeFile(path.join(directory, 'value.txt'), 'disposable')
          if (input.hold) {
            held.entered.resolve()
            await held.release.promise
          }
          if (input.dispose) await disposeStaging(ctx, directory)
          return true
        },
      }),
    ],
  })
  t.after(async () => {
    await service.dispose()
    await artifacts.dispose()
    await fs.rm(root, { recursive: true, force: true })
  })
  async function run(operation, payload = {}, scope = scopes[0]) {
    const admitted = await service.submit(actor, {
      v: 1,
      type: 'command',
      requestId: randomUUID(),
      commandId: randomUUID(),
      session: service.session,
      createdAt: new Date().toISOString(),
      scope,
      operation,
      payload,
    })
    const outcome = await admitted.outcome
    if (outcome.error)
      throw Object.assign(new Error(outcome.error.message), outcome.error)
    return outcome.payload
  }
  return {
    root,
    scopes,
    service,
    artifacts,
    run,
    get last() {
      return last
    },
    deny(value) {
      deny = value
    },
    read: () => service.query(actor, scopes[0], 'recovery.read', {}),
    async stage(scope = scopes[0]) {
      await run('fixture.stage', {}, scope)
      return last
    },
    hold() {
      held = {
        entered: Promise.withResolvers(),
        release: Promise.withResolvers(),
      }
      return held
    },
    async owner(pid, scope = scopes[0]) {
      return {
        ...operationOwner(scope, {
          session: randomUUID(),
          operationId: randomUUID(),
        }),
        pid,
      }
    },
    async process(owner, extra = {}) {
      const directory = path.join(
        root,
        '.cache/workspace',
        owner.scope.workspaceId,
        owner.scope.packId,
        'processes',
      )
      await fs.mkdir(directory, { recursive: true })
      const file = path.join(directory, randomUUID() + '.json')
      await fs.writeFile(
        file,
        JSON.stringify({
          schema: 1,
          scope: owner.scope,
          session: owner.session,
          operationId: owner.operationId,
          name: 'objects.export',
          owner,
          parentPid: owner.pid,
          pid: owner.pid,
          groupId: owner.pid,
          ...extra,
        }),
      )
      await fs.writeFile(
        file.replace('.json', '.context.json'),
        JSON.stringify({
          paths: { private: '/Users/private-do-not-expose' },
          secret: 'fixture secret',
        }),
      )
      return file
    },
    async ageStage(stage, owner) {
      const file = path.join(path.dirname(stage.directory), 'owner.json'),
        record = JSON.parse(await fs.readFile(file, 'utf8'))
      record.owner = owner
      await fs.writeFile(file, JSON.stringify(record))
      return file
    },
  }
}

test('owned staging hides metadata from generators and normal disposal removes its whole container', async (t) => {
  const f = await fixture(t),
    held = f.hold(),
    running = f.run('fixture.stage', { hold: true, dispose: true })
  await held.entered.promise
  try {
    assert.deepEqual(await fs.readdir(f.last.directory), ['value.txt'])
    assert(
      (await fs.readdir(path.dirname(f.last.directory))).includes('owner.json'),
    )
    assert.equal((await f.read()).entries.length, 0)
  } finally {
    held.release.resolve()
  }
  await running
  assert.deepEqual(
    await fs.readdir(path.join(f.root, '.cache/workspace/staging')),
    [],
  )
})

test('confirmed dead staging and native contexts clean together while outside files and source backups remain', async (t) => {
  const f = await fixture(t),
    dead = await deadProcess(),
    stage = await f.stage(),
    owner = await f.owner(dead)
  await f.ageStage(stage, owner)
  const marker = await f.process(owner)
  const outside = path.join(f.root, 'kept-world')
  await fs.writeFile(outside, 'world and LODs')
  await fs.symlink(outside, path.join(stage.directory, 'world-link'))
  const transaction = path.join(
    f.root,
    '.cache/workspace/local/alpha/transactions',
    randomUUID(),
  )
  await fs.mkdir(transaction, { recursive: true })
  await fs.writeFile(
    path.join(transaction, 'transaction.json'),
    JSON.stringify({
      schema: 1,
      owner,
      before: {
        'map:recipes': {
          text: 'private previous source',
          revision: '0'.repeat(64),
        },
      },
      next: { 'map:recipes': '1'.repeat(64) },
    }),
  )
  const snapshot = await f.read()
  assert.equal(snapshot.entries.filter((entry) => entry.canClean).length, 2)
  assert(
    snapshot.entries.some(
      (entry) =>
        entry.kind === 'source-transaction' &&
        !entry.canClean &&
        entry.sources.includes('map:recipes'),
    ),
  )
  assert(!JSON.stringify(snapshot).includes('fixture secret'))
  assert(!JSON.stringify(snapshot).includes(f.root))
  assert(!JSON.stringify(snapshot).includes('private previous source'))
  assert.deepEqual(
    await f.run('recovery.cleanup', { revision: snapshot.revision }),
    { removed: 2 },
  )
  await assert.rejects(fs.access(marker))
  await assert.rejects(fs.access(path.dirname(stage.directory)))
  assert.equal(await fs.readFile(outside, 'utf8'), 'world and LODs')
  assert(await fs.stat(path.join(transaction, 'transaction.json')))
})

test('live process groups, unsupported ownership and unowned legacy data are preserved', async (t) => {
  const f = await fixture(t),
    dead = await deadProcess(),
    stage = await f.stage(),
    owner = await f.owner(dead)
  await f.ageStage(stage, owner)
  const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    }),
    exited = once(child, 'close')
  const marker = await f.process(owner, { pid: child.pid, groupId: child.pid })
  const legacy = path.join(f.root, '.cache/workspace/staging/old-unowned')
  await fs.mkdir(legacy)
  await fs.writeFile(path.join(legacy, 'keep.txt'), 'keep')
  try {
    const snapshot = await f.read()
    assert(snapshot.entries.length >= 3)
    assert(snapshot.entries.every((entry) => !entry.canClean))
    assert.deepEqual(
      await f.run('recovery.cleanup', { revision: snapshot.revision }),
      { removed: 0 },
    )
    process.kill(child.pid, 0)
    assert(await fs.stat(marker))
    assert(await fs.stat(path.join(legacy, 'keep.txt')))
  } finally {
    child.kill('SIGTERM')
    await exited
  }
})

test('changed recovery evidence refuses a stale cleanup, and revoked child permissions filter rows and revisions', async (t) => {
  const f = await fixture(t),
    dead = await deadProcess(),
    owner = await f.owner(dead),
    marker = await f.process(owner)
  const first = await f.read()
  await fs.appendFile(marker.replace('.json', '.context.json'), '\n')
  await assert.rejects(
    f.run('recovery.cleanup', { revision: first.revision }),
    (error) => error.code === 'REVISION_CONFLICT',
  )
  assert(await fs.stat(marker))
  f.deny(
    (action, target) =>
      action === 'operation.read' && target.id === owner.operationId,
  )
  const denied = await f.read()
  assert.equal(denied.entries.length, 0)
  await fs.appendFile(marker, '\n')
  assert.equal((await f.read()).revision, denied.revision)
})

test('scoped recovery does not expose another pack or inspect unowned shared staging', async (t) => {
  const f = await fixture(t, true),
    dead = await deadProcess(),
    own = await f.stage(),
    foreign = await f.stage(f.scopes[1])
  await f.ageStage(own, await f.owner(dead))
  await f.ageStage(foreign, await f.owner(dead, f.scopes[1]))
  const snapshot = await f.read()
  assert.equal(snapshot.entries.length, 1)
  await f.run('recovery.cleanup', { revision: snapshot.revision })
  await assert.rejects(fs.access(own.directory))
  assert(await fs.stat(foreign.directory))
})

test('artifact maintenance locks require confirmed absence and exact revision, and malformed locks stay visible', async (t) => {
  const f = await fixture(t),
    dead = await deadProcess(),
    lock = path.join(f.root, '.cache/workspace/artifacts/retention.lock')
  await fs.mkdir(path.dirname(lock), { recursive: true })
  await fs.writeFile(
    lock,
    JSON.stringify({
      schema: 1,
      hostId: randomUUID(),
      pid: dead,
      hostname: os.hostname(),
    }),
  )
  const snapshot = await f.read()
  assert.equal(snapshot.entries[0].kind, 'artifact-lock')
  assert(snapshot.entries[0].canClean)
  await f.run('recovery.cleanup', { revision: snapshot.revision })
  await assert.rejects(fs.access(lock))
  await fs.writeFile(lock, '{')
  const malformed = await f.read()
  assert.equal(malformed.entries[0].state, 'unknown')
  assert(!malformed.entries[0].canClean)
  await f.run('recovery.cleanup', { revision: malformed.revision })
  assert.equal(await fs.readFile(lock, 'utf8'), '{')
})

test('denied recovery performs no cache initialization', async (t) => {
  const f = await fixture(t)
  f.deny(
    (action, target) => action === 'source.read' && target.id === 'recovery',
  )
  await assert.rejects(f.read(), (error) => error.code === 'NOT_FOUND')
  await assert.rejects(
    fs.access(path.join(f.root, '.cache')),
    (error) => error.code === 'ENOENT',
  )
})

test('read-only cleanup grants and unrecognized process metadata preserve staging', async (t) => {
  const f = await fixture(t),
    dead = await deadProcess(),
    stage = await f.stage(),
    owner = await f.owner(dead)
  await f.ageStage(stage, owner)
  f.deny(
    (action, target) => action === 'generation.run' && target.id === 'recovery',
  )
  assert((await f.read()).entries.every((entry) => !entry.canClean))
  f.deny(() => false)
  const directory = path.join(f.root, '.cache/workspace/local/alpha/processes')
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, randomUUID() + '.json.tmp'), '{}')
  const snapshot = await f.read()
  assert(
    snapshot.entries.some(
      (entry) => entry.label === 'Unrecognized execution metadata',
    ),
  )
  assert(snapshot.entries.every((entry) => !entry.canClean))
  await f.run('recovery.cleanup', { revision: snapshot.revision })
  assert(await fs.stat(stage.directory))
})
