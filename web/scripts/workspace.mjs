import crypto from 'node:crypto'
import { root } from './compile.mjs'
import { configuredPack } from './configuration.mjs'
import { createLocalWorkspace } from './workspace/runtime.ts'
import { failure } from './workspace/errors.ts'
import { admitDelivery, openPolicy } from './workspace/policy.ts'

export function workspace(options = {}) {
  // Public builds and Vite modules cannot contain restricted pack content.
  admitDelivery('open-local', options.policy ?? openPolicy)
  return {
    name: 'atlas-local-workspace',
    async configureServer(server) {
      // Astro's type/build sync also creates a middleware-only Vite server.
      // It has no request host and must not start workspace resources.
      if (!server.httpServer) return
      const local = createLocalWorkspace({
        server: server.httpServer,
        web: root,
        pack: await configuredPack(root),
        origins: () => {
          const address = server.httpServer.address()
          const port =
            address && typeof address !== 'string'
              ? address.port
              : server.config.server.port
          return [
            `http://127.0.0.1:${port}`,
            `http://localhost:${port}`,
            `http://[::1]:${port}`,
          ]
        },
      })
      server.httpServer.once('close', () => void local.dispose())
      server.middlewares.use((req, res, next) => {
        void local
          .http(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(next)
      })
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__atlas/')) return next()
        const send = (status, value) => {
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          })
          res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value))
        }
        if (
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
            req.socket.remoteAddress,
          )
        )
          return send(403, { error: 'Local workspace only' })
        if (
          !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(
            req.headers.host ?? '',
          )
        )
          return send(403, { error: 'Loopback host required' })
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`
        )
          return send(403, { error: 'Same-origin requests required' })
        try {
          const actor = {
            principal: { kind: 'anonymous', id: 'local-open' },
            connectionId: crypto.randomUUID(),
          }
          const reads = {
            '/__atlas/workspace': 'map.sources.read',
            '/__atlas/resource-reviews': 'reviews.read',
            '/__atlas/models': 'models.read',
            '/__atlas/authoring': 'quests.read',
          }
          if (!['GET', 'HEAD'].includes(req.method))
            return send(405, { error: 'Use workspace commands for changes' })
          if (req.url === '/__atlas/jobs')
            return send(200, {
              operations: await local.service.query(
                actor,
                local.scope,
                'activity.read',
                {},
              ),
              definitions: local.service.definitions(),
            })
          const operation = reads[req.url]
          if (!operation)
            return send(404, { error: 'Unknown workspace endpoint' })
          return send(
            200,
            await local.service.query(actor, local.scope, operation, {}),
          )
        } catch (error) {
          const result = failure(error)
          send(
            [
              'BUSY',
              'REVISION_CONFLICT',
              'COMMAND_ID_CONFLICT',
              'SOURCE_PARTIAL',
              'OUTCOME_UNKNOWN',
            ].includes(result.code)
              ? 409
              : result.code === 'NOT_FOUND'
                ? 404
                : result.code === 'STORAGE_UNAVAILABLE'
                  ? 503
                  : 400,
            { error: result.message, code: result.code },
          )
        }
      })
    },
  }
}
