import { randomUUID, createHash } from 'node:crypto'

export function recordWorkspaceWrites(page, writes) {
  page.on('websocket', (socket) => {
    if (!socket.url().endsWith('/__atlas/ws')) return
    socket.on('framesent', ({ payload }) => {
      try {
        const frame = JSON.parse(String(payload))
        if (
          frame.type === 'command' &&
          /\.(save|generate|refresh)$/.test(frame.operation)
        )
          writes.push(frame.operation)
      } catch {
        /* HMR and binary frames are not authoring commands. */
      }
    })
  })
}

// Browser-only wire fixture. Real admission/policy/filesystem behavior is checked
// by the Node service and actual-socket tests, not inferred from these responses.
export async function mockWorkspace(page, handler, capabilities, options = {}) {
  const session = randomUUID(),
    scope = { workspaceId: 'local', packId: 'create_sky' },
    artifacts = new Map(),
    connections = new Map()
  let connectionCount = 0
  function artifact(value) {
    const text = JSON.stringify(value),
      sha256 = createHash('sha256').update(text).digest('hex')
    const id = createHash('sha256')
      .update(randomUUID() + sha256)
      .digest('hex')
    const url = `/__atlas/workspaces/local/packs/create_sky/artifacts/${id}`
    artifacts.set(url, text)
    return {
      id,
      scope,
      generationId: randomUUID(),
      mediaType: 'application/json',
      byteLength: Buffer.byteLength(text),
      sha256,
      inputRevision: sha256,
      url,
    }
  }
  await page.route('**/__atlas/workspaces/**/artifacts/*', (route) => {
    const text = artifacts.get(new URL(route.request().url()).pathname)
    return text === undefined
      ? route.fulfill({ status: 404 })
      : route.fulfill({ contentType: 'application/json', body: text })
  })
  await page.route('**/__atlas/workspaces/**/results/*', (route) => {
    const text = artifacts.get(new URL(route.request().url()).pathname)
    return text === undefined
      ? route.fulfill({ status: 404 })
      : route.fulfill({ contentType: 'application/json', body: text })
  })
  await page.routeWebSocket('**/__atlas/ws', (socket) => {
    connectionCount++
    const subscriptions = new Map()
    connections.set(socket, subscriptions)
    socket.onClose((code, reason) => {
      connections.delete(socket)
      void socket.close({ code, reason })
    })
    socket.onMessage(async (text) => {
      const frame = JSON.parse(text)
      const send = (type, value) =>
        socket.send(JSON.stringify({ v: 1, type, session, ...value }))
      const reply = (correlation, payload) => {
        const text = JSON.stringify(payload)
        if (Buffer.byteLength(text) < 250000)
          return send('result', { ...correlation, payload })
        const id = randomUUID(),
          url = `/__atlas/workspaces/local/packs/create_sky/results/${id}`
        artifacts.set(url, text)
        send('result-reference', {
          ...correlation,
          reference: {
            id,
            url,
            scope,
            byteLength: Buffer.byteLength(text),
            sha256: createHash('sha256').update(text).digest('hex'),
          },
        })
      }
      if (frame.type === 'hello') {
        send('welcome', {
          requestId: frame.requestId,
          scope,
          serverTime: new Date().toISOString(),
          protocol: 'atlas.v1',
          cursor: 0,
          capabilities,
        })
        return
      }
      if (frame.type === 'subscribe') {
        reply(
          { requestId: frame.requestId },
          {
            subscriptions: await Promise.all(
              frame.topics.map(async (topic) => {
                const id = randomUUID()
                subscriptions.set(topic, { id, sequence: 0 })
                return {
                  id,
                  topic,
                  sequence: 0,
                  snapshot: options.snapshot
                    ? await options.snapshot(topic, session)
                    : { session, current: null, history: [] },
                }
              }),
            ),
          },
        )
        return
      }
      if (frame.type === 'unsubscribe') {
        for (const [topic, sub] of subscriptions)
          if (frame.subscriptionIds.includes(sub.id))
            subscriptions.delete(topic)
        send('result', {
          requestId: frame.requestId,
          payload: { unsubscribed: true },
        })
        return
      }
      const operationId = randomUUID()
      const correlation = {
        requestId: frame.requestId,
        ...(frame.type === 'command'
          ? { commandId: frame.commandId, operationId }
          : {}),
      }
      if (frame.type === 'command') send('accepted', correlation)
      try {
        reply(correlation, await handler(frame, { artifact, session }))
      } catch (error) {
        send('error', {
          ...correlation,
          error: {
            code: error.code ?? 'GENERATION_FAILED',
            message: error.message,
            recovery: 'after-refresh',
          },
        })
      }
    })
  })
  return {
    get connectionCount() {
      return connectionCount
    },
    session,
    scope,
    emit(topic, payload) {
      for (const [socket, subscriptions] of connections) {
        const sub = subscriptions.get(topic)
        if (sub)
          socket.send(
            JSON.stringify({
              v: 1,
              type: 'event',
              session,
              scope,
              topic,
              subscriptionId: sub.id,
              sequence: ++sub.sequence,
              payload,
            }),
          )
      }
    },
    async disconnect() {
      await Promise.all(
        [...connections.keys()].map((socket) =>
          socket.close({ code: 1013, reason: 'Fixture interrupted' }),
        ),
      )
    },
  }
}

export function activityOperation(overrides = {}) {
  return {
    id: randomUUID(),
    commandId: randomUUID(),
    scope: { workspaceId: 'local', packId: 'create_sky' },
    name: 'fixture.generate',
    effect: 'generate',
    label: 'Fixture',
    href: '/authoring',
    state: 'succeeded',
    message: 'Complete',
    startedAt: new Date().toISOString(),
    inputsRevision: '0'.repeat(64),
    inputCount: 0,
    stages: [],
    stageCount: 0,
    stagesTruncated: false,
    ...overrides,
  }
}
