import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mockWorkspace, activityOperation } from './workspace-fixture.mjs'

test('revision events coalesce into pure metadata reads and exact own saves do not look external', async ({
  page,
}) => {
  let revision = 'a'.repeat(64),
    reads = 0
  const inventory = () => ({
    entries: [{ id: 'models', revision }],
    revision,
    monitoring: 'ready',
    restartRequired: false,
  })
  const fixture = await mockWorkspace(
    page,
    async (frame) => {
      if (frame.operation === 'sources.inventory') {
        reads++
        return inventory()
      }
      if (frame.operation === 'fixture.save') {
        revision = 'b'.repeat(64)
        fixture.emit('sources', {
          kind: 'invalidated',
          commandId: frame.commandId,
          sources: ['models'],
          revisions: { models: revision },
        })
        return { saved: true }
      }
      throw new Error('Unexpected operation: ' + frame.operation)
    },
    ['sources.inventory', 'fixture.save'],
    { snapshot: () => inventory() },
  )
  await page.goto('/resourcepacks')
  await page.evaluate(async () => {
    const { observeWorkspaceChanges } =
      await import('/src/lib/workspace/changes.ts')
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    await workspaceClient.query('sources.inventory', {})
    window.sourceChanges = []
    window.stopChanges = observeWorkspaceChanges({
      sources: () => true,
      changed: (change) => window.sourceChanges.push(change),
    })
    await workspaceClient.command('fixture.save', {})
  })
  await expect.poll(() => reads).toBe(2)
  expect(await page.evaluate(() => window.sourceChanges)).toEqual([])
  revision = 'c'.repeat(64)
  for (let i = 0; i < 12; i++)
    fixture.emit('sources', {
      kind: 'invalidated',
      sources: ['models'],
      external: true,
    })
  await expect
    .poll(() => page.evaluate(() => window.sourceChanges.length))
    .toBe(1)
  expect(reads).toBe(3)
  expect(fixture.connectionCount).toBe(1)
})

test('large snapshots buffer intervening events and large queries resolve through checked downloads', async ({
  page,
}) => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers()
  const operation = activityOperation({
    message: 'Completed while snapshot was loading',
  })
  const fixture = await mockWorkspace(
    page,
    async () => ({ text: 'source '.repeat(60000) }),
    ['activity.read', 'map.sources.read'],
    {
      snapshot: (topic, session) =>
        topic === 'sources'
          ? { text: 'snapshot '.repeat(50000) }
          : { session, current: null, history: [] },
    },
  )
  let polls = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/__atlas/jobs')) polls++
  })
  await page.route('**/__atlas/workspaces/**/results/*', async (route) => {
    entered.resolve()
    await release.promise
    return route.fallback()
  })
  await page.goto('/resourcepacks')
  await entered.promise
  fixture.emit('activity', { operation })
  release.resolve()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { workspaceClient } = await import('/src/lib/workspace/client.ts')
        return workspaceClient.getSnapshot().topics.activity?.snapshot
          ?.history?.[0]?.id
      }),
    )
    .toBe(operation.id)
  const length = await page.evaluate(async () => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    return (await workspaceClient.query('fixture.read', {})).text.length
  })
  expect(length).toBe(420000)
  expect(fixture.connectionCount).toBe(1)
  expect(polls).toBe(0)
})

test('shared browser client opens one real socket for concurrent source reads and subscriptions', async ({
  page,
}) => {
  let sockets = 0
  page.on('websocket', (socket) => {
    if (socket.url().endsWith('/__atlas/ws')) sockets++
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/resourcepacks')
  const result = await page.evaluate(async () => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    const off = workspaceClient.subscribe(() => {})
    const [one, two] = await Promise.all([
      workspaceClient.query('map.sources.read', {}),
      workspaceClient.query('map.sources.read', {}),
    ])
    off()
    return {
      revisions: [one.revision, two.revision],
      sources: Object.keys(one.files),
      connection: workspaceClient.getSnapshot().connection,
    }
  })
  expect(sockets).toBe(1)
  expect(result.revisions[0]).toEqual(result.revisions[1])
  expect(result.sources).toHaveLength(8)
  expect(result.connection).toBe('online')
  expect(errors).toEqual([])
})

test('malformed server messages close with a legal browser code and reconnect without a page error', async ({
  page,
}) => {
  const session = randomUUID()
  const errors = [],
    closed = []
  let connections = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.routeWebSocket('**/__atlas/ws', (socket) => {
    const first = ++connections === 1
    socket.onClose((code, reason) => {
      closed.push(code)
      void socket.close({ code, reason })
    })
    socket.onMessage((text) => {
      const frame = JSON.parse(text)
      if (first) {
        socket.send('{"v":2,"type":"welcome"}')
        return
      }
      socket.send(
        JSON.stringify({
          v: 1,
          type: 'welcome',
          session,
          requestId: frame.requestId,
          serverTime: new Date().toISOString(),
          protocol: 'atlas.v1',
          scope: frame.scope,
          cursor: 0,
          capabilities: [],
        }),
      )
    })
  })
  await page.goto('/resourcepacks')
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await import('/src/lib/workspace/client.ts')
          ).workspaceClient.getSnapshot().connection,
      ),
    )
    .toBe('online')
  expect(connections).toBe(2)
  expect(closed).toContain(4008)
  expect(errors).toEqual([])
})

test('ambiguous mutation is reconciled after reconnect without replay, and a sequence gap obtains a new snapshot', async ({
  page,
}) => {
  const session = randomUUID(),
    operationId = randomUUID()
  let starts = 0,
    connections = 0,
    subscriptions = 0,
    active,
    subId
  let commandId
  await page.routeWebSocket('**/__atlas/ws', (socket) => {
    connections++
    active = socket
    socket.onMessage((message) => {
      const input = JSON.parse(message)
      const reply = (type, fields) =>
        socket.send(JSON.stringify({ v: 1, type, session, ...fields }))
      if (input.type === 'hello')
        reply('welcome', {
          requestId: input.requestId,
          serverTime: new Date().toISOString(),
          protocol: 'atlas.v1',
          scope: input.scope,
          capabilities: ['activity.read'],
          cursor: 0,
        })
      else if (input.type === 'subscribe') {
        subscriptions++
        subId = randomUUID()
        reply('result', {
          requestId: input.requestId,
          payload: {
            subscriptions: [
              {
                id: subId,
                topic: 'activity',
                sequence: 0,
                snapshot: { session, current: null, history: [] },
              },
            ],
          },
        })
      } else if (input.type === 'command') {
        starts++
        commandId = input.commandId
        reply('accepted', {
          requestId: input.requestId,
          commandId,
          operationId,
        })
        void socket.close({ code: 1013, reason: 'Lost response fixture' })
      } else if (input.type === 'query')
        reply('result', {
          requestId: input.requestId,
          payload: {
            id: operationId,
            commandId,
            scope: input.scope,
            name: 'fixture.generate',
            effect: 'generate',
            label: 'Fixture',
            href: '/',
            state: 'succeeded',
            message: 'Complete',
            startedAt: new Date().toISOString(),
            inputs: {},
            stages: [],
          },
        })
      else if (input.type === 'unsubscribe')
        reply('result', {
          requestId: input.requestId,
          payload: { unsubscribed: true },
        })
    })
  })
  await page.goto('/resourcepacks')
  const failed = await page.evaluate(async () => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    try {
      await workspaceClient.command('fixture.generate', {})
      return null
    } catch (error) {
      return { code: error.failure.code, commandId: error.commandId }
    }
  })
  expect(failed).toEqual({ code: 'OUTCOME_UNKNOWN', commandId })
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { workspaceClient } = await import('/src/lib/workspace/client.ts')
        return workspaceClient.getSnapshot().commands[0]?.outcome?.state
      }),
    )
    .toBe('succeeded')
  expect(starts).toBe(1)
  expect(connections).toBe(2)
  active.send(
    JSON.stringify({
      v: 1,
      type: 'event',
      session,
      subscriptionId: subId,
      scope: { workspaceId: 'local', packId: 'create_skyweave' },
      topic: 'activity',
      sequence: 3,
      payload: {},
    }),
  )
  await expect.poll(() => subscriptions).toBe(3)
  expect(starts).toBe(1)
})

test('static delivery does not open a fake live connection or enable writes', async ({
  page,
}) => {
  let sockets = 0
  page.on('websocket', (socket) => {
    if (socket.url().endsWith('/__atlas/ws')) sockets++
  })
  await page.route('**/__atlas/bootstrap', (route) =>
    route.fulfill({ status: 404, body: 'Not found' }),
  )
  await page.goto('/resourcepacks')
  const result = await page.evaluate(async () => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    try {
      await workspaceClient.command('map.source.save', {})
      return null
    } catch (error) {
      return {
        code: error.failure.code,
        connection: workspaceClient.getSnapshot().connection,
      }
    }
  })
  expect(result).toEqual({ code: 'STORAGE_UNAVAILABLE', connection: 'static' })
  expect(sockets).toBe(0)
})

test('map source drafts survive domain switches and external saved revisions', async ({
  page,
}) => {
  const saved = await (await page.request.get('/__atlas/workspace')).json()
  const originalRevision = saved.files.items.revision
  let submittedRevision
  const inventory = () => ({
    entries: [{ id: 'map:items', revision: saved.files.items.revision }],
    revision: saved.revision,
    monitoring: 'ready',
    restartRequired: false,
  })
  const fixture = await mockWorkspace(
    page,
    async (frame) => {
      if (frame.operation === 'map.sources.read') return saved
      if (frame.operation === 'sources.inventory') return inventory()
      if (frame.operation === 'map.source.save') {
        submittedRevision = frame.payload.revision
        throw Object.assign(
          new Error('Source changed; your draft has been kept.'),
          { code: 'REVISION_CONFLICT' },
        )
      }
      throw new Error('Unexpected operation: ' + frame.operation)
    },
    ['map.sources.read', 'sources.inventory', 'map.source.save'],
    { snapshot: () => inventory() },
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit data', exact: true }).click()
  const editor = page.locator('#domain-editor'),
    select = page.getByLabel('Edit domain')
  await expect(select).toHaveValue('items')
  await editor.fill('# item draft kept locally')
  await select.selectOption('recipes')
  await editor.fill('# recipe draft kept locally')
  await select.selectOption('items')
  await expect(editor).toHaveValue('# item draft kept locally')
  await select.selectOption('recipes')
  await expect(editor).toHaveValue('# recipe draft kept locally')
  await page
    .getByRole('button', { name: 'Reload from disk', exact: true })
    .click()
  await expect(editor).toHaveValue(saved.files.recipes.text)
  await select.selectOption('items')
  await expect(editor).toHaveValue('# item draft kept locally')
  saved.files.items = {
    text: saved.files.items.text + '\n# external edit',
    revision: 'e'.repeat(64),
  }
  saved.revision = 'f'.repeat(64)
  fixture.emit('sources', {
    kind: 'invalidated',
    sources: ['map:items'],
    external: true,
  })
  await expect(page.locator('#editor-status')).toContainText(
    'Saved source changed',
  )
  await expect(editor).toHaveValue('# item draft kept locally')
  await page
    .getByRole('button', { name: 'Save & rebuild map', exact: true })
    .click()
  await expect.poll(() => submittedRevision).toBe(originalRevision)
  await expect(editor).toHaveValue('# item draft kept locally')
})

test('a published map refreshes the visible graph and world without resetting graph navigation', async ({
  page,
}) => {
  let generationId = randomUUID(),
    routeReads = 0
  const inventory = () => ({
    entries: [
      {
        namespace: 'map',
        generationId,
        inputRevision: 'a'.repeat(64),
        publishedAt: new Date().toISOString(),
      },
    ],
    revision: 'b'.repeat(64),
  })
  const fixture = await mockWorkspace(
    page,
    async (frame) => {
      if (frame.operation === 'projections.inventory') return inventory()
      throw new Error('Unexpected operation: ' + frame.operation)
    },
    ['activity.read', 'projection.read', 'projections.inventory'],
    {
      snapshot: (topic, session) =>
        topic === 'projections'
          ? inventory()
          : { session, current: null, history: [] },
    },
  )
  await page.route('**/generated/routes.json', (route) => {
    routeReads++
    return route.fallback()
  })
  const world = await (await page.request.get('/generated/world.json')).json()
  let sampledChunks = 123
  await page.route('**/generated/world.json', (route) =>
    route.fulfill({ json: { ...world, sampledChunks } }),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Progression graph', exact: true })
    .click()
  const graph = page.locator('#graph-canvas')
  await expect(graph).toHaveAttribute('data-view', 'systems')
  await graph.focus()
  const beforePan = await graph.getAttribute('data-pan-x')
  await page.keyboard.press('ArrowRight')
  await expect(graph).not.toHaveAttribute('data-pan-x', beforePan)
  const pan = await graph.getAttribute('data-pan-x'),
    initial = routeReads
  generationId = randomUUID()
  fixture.emit('projections', {
    kind: 'published',
    namespace: 'map',
    generationId,
  })
  await expect.poll(() => routeReads).toBeGreaterThan(initial)
  await expect(graph).toHaveAttribute('data-pan-x', pan)
  await page.getByRole('button', { name: 'World & ores', exact: true }).click()
  await expect(page.locator('#world-summary')).toContainText('123')
  sampledChunks = 567
  generationId = randomUUID()
  fixture.emit('projections', {
    kind: 'published',
    namespace: 'map',
    generationId,
  })
  await expect(page.locator('#world-summary')).toContainText('567')
})

for (const [code, status] of [
  ['OUTCOME_UNKNOWN', 'unconfirmed'],
  ['GENERATION_FAILED', 'failed'],
]) {
  test(`confirmed map source saves survive ${status} generation without replay`, async ({
    page,
  }) => {
    const saved = await (await page.request.get('/__atlas/workspace')).json()
    let saves = 0,
      compiles = 0
    await mockWorkspace(
      page,
      async (frame) => {
        if (frame.operation === 'map.sources.read') return saved
        if (frame.operation === 'map.source.save') {
          saves++
          saved.files[frame.payload.name] = {
            text: frame.payload.text,
            revision: 'e'.repeat(64),
          }
          saved.revision = 'f'.repeat(64)
          return { revision: 'e'.repeat(64), sourceSaved: true }
        }
        expect(frame.operation).toBe('map.compile')
        compiles++
        throw Object.assign(new Error('Fixture generation outcome'), { code })
      },
      ['map.sources.read', 'map.source.save', 'map.compile'],
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Edit data', exact: true }).click()
    const editor = page.locator('#domain-editor')
    await expect(editor).not.toHaveValue('')
    await editor.fill('# saved source')
    await page
      .getByRole('button', { name: 'Save & rebuild map', exact: true })
      .click()
    await expect(page.locator('#editor-status')).toContainText(
      `Source saved; map refresh ${status}`,
    )
    await expect(editor).toHaveValue('# saved source')
    await expect(page.locator('#reload-editor')).toHaveAttribute(
      'data-intent',
      'default',
    )
    expect(saves).toBe(1)
    expect(compiles).toBe(1)
  })
}

test('Vite raw-module delivery excludes private caches and local inputs while normal modules remain available', async ({
  page,
}) => {
  const fs = await import('node:fs/promises'),
    path = await import('node:path')
  const folder = await fs.mkdtemp(path.resolve('.cache/http-boundary-')),
    file = path.join(folder, 'private.json')
  await fs.writeFile(file, '{"fixture":"private workspace context"}')
  try {
    for (const suffix of ['?raw', '?url', '']) {
      const response = await page.request.get('/@fs' + file + suffix)
      expect([403, 404]).toContain(response.status())
      expect(await response.text()).not.toContain('private workspace context')
    }
    const source = await page.request.get('/src/lib/recipe-view.mjs?raw')
    expect(source.status()).toBe(200)
    expect((await page.request.get('/@vite/client')).status()).toBe(200)
    expect((await page.request.get('/generated/catalog.json')).status()).toBe(
      200,
    )
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
})
