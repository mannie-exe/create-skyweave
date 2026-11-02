import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { domains, validateDomain } from '../src/lib/domains.mjs'
import { compile, root } from './compile.mjs'
import { authoring, configuredPack } from './authoring.mjs'
import { resourceReviews } from './resource-reviews.mjs'
import { modelAuthoring } from './model-authoring.mjs'
import { jobs, jobRegistry, JobError } from './jobs.mjs'
import { createOperations } from './operations.mjs'
import { generatedResourceAssets } from './generated-resource-assets.mjs'
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex')

export function workspace() {
  let busy = false
  const operations = createOperations()
  return {
    name: 'atlas-local-workspace',
    configureServer(server) {
      server.middlewares.use(generatedResourceAssets(root))
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__atlas/')) return next()
        let operation = null
        const send = (status, value) => {
          if (operation) {
            operations.finish(
              operation,
              status >= 400 ? value.error || 'Operation failed' : null,
              value.code,
            )
            operation = null
          }
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          })
          res.end(JSON.stringify(value))
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
        let acquired = false
        try {
          // Status and cancellation remain available while another request owns the workspace.
          if (req.method === 'GET' && req.url === '/__atlas/jobs')
            return send(200, {
              ...jobs.snapshot(),
              operations: operations.snapshot(jobs.snapshot().current),
              busy,
              definitions: Object.entries(jobRegistry).map(([name, job]) => ({
                name,
                cwd: job.cwd,
                inputs: job.inputs,
                outputs: job.outputs,
                timeoutMs: job.timeoutMs,
                maxBytes: job.maxBytes,
                cancellable: job.cancellable && process.platform !== 'win32',
              })),
            })
          let input = {}
          if (req.method !== 'GET') {
            if (
              req.method !== 'POST' ||
              req.headers['content-type'] !== 'application/json'
            )
              return send(405, { error: 'Use JSON POST' })
            if (!req.headers.origin)
              return send(403, { error: 'Origin header required for writes' })
            const chunks = []
            let size = 0
            for await (const chunk of req) {
              size += chunk.length
              if (size > 1100000)
                return send(413, { error: 'Request too large' })
              chunks.push(chunk)
            }
            input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if (!input || typeof input !== 'object' || Array.isArray(input))
              return send(400, { error: 'Expected a JSON object' })
          }
          if (req.method === 'POST' && req.url === '/__atlas/jobs/cancel') {
            if (
              Object.keys(input).join() !== 'id' ||
              typeof input.id !== 'string'
            )
              return send(400, { error: 'Expected a job ID' })
            return send(200, jobs.cancel(input.id))
          }
          if (busy)
            throw new JobError(
              'Another authoring operation is running; retry when it finishes',
              'busy',
            )
          busy = acquired = true
          operation = operations.begin(req.method, req.url, input)
          const context = { web: root, pack: await configuredPack(root) }
          if (req.method === 'GET') {
            if (req.url === '/__atlas/resource-reviews')
              return send(200, await resourceReviews(root).read())
            if (req.url === '/__atlas/models')
              return send(200, await modelAuthoring(context.pack).read())
            if (req.url === '/__atlas/authoring')
              return send(200, await authoring(context.pack).read())
            if (req.url === '/__atlas/authoring/audit')
              return send(200, await authoring(context.pack).audit())
            if (req.url === '/__atlas/workspace') {
              const files = {}
              for (const name of domains) {
                const text = await fs.readFile(
                  path.join(root, 'data/authored', name + '.yml'),
                  'utf8',
                )
                files[name] = { text, revision: hash(text) }
              }
              return send(200, { files })
            }
            if (req.url === '/__atlas/status') {
              const snapshot = JSON.parse(
                await fs.readFile(
                  path.join(root, 'data/generated/runtime/snapshot.json'),
                  'utf8',
                ),
              )
              const current = await jobs.run('snapshot.fingerprint', context)
              return send(200, {
                stale: current.stdout.trim() !== snapshot.sourceFingerprint,
                changedDuringExport: snapshot.sourceChangedDuringExport,
              })
            }
            return send(404, { error: 'Unknown workspace endpoint' })
          }
          if (req.url === '/__atlas/resource-reviews/save')
            return send(200, await resourceReviews(root).save(input))
          if (req.url === '/__atlas/textures/generate') {
            if (Object.keys(input).length)
              throw new Error('Texture generation accepts no inputs')
            const result = await jobs.run('textures.generate', context)
            return send(200, { output: result.stdout.trim() })
          }
          if (
            [
              '/__atlas/models/preview',
              '/__atlas/models/save',
              '/__atlas/models/generate',
            ].includes(req.url)
          ) {
            const action = req.url.split('/').at(-1)
            return send(
              200,
              await modelAuthoring(context.pack)[action](
                action === 'preview' ? input.document : input,
              ),
            )
          }
          if (
            ['/__atlas/authoring/save', '/__atlas/authoring/generate'].includes(
              req.url,
            )
          )
            return send(
              200,
              await authoring(context.pack)[
                req.url.endsWith('/save') ? 'save' : 'generate'
              ](input),
            )
          if (req.url === '/__atlas/objects/preview') {
            const result = await jobs.run('objects.preview', context, input)
            return send(200, JSON.parse(result.stdout))
          }
          if (
            [
              '/__atlas/objects/generate',
              '/__atlas/objects/export',
              '/__atlas/objects/inputs',
            ].includes(req.url)
          ) {
            if (Object.keys(input).length)
              throw new Error('Object refresh accepts no inputs')
            const result = await jobs.run(
              req.url.endsWith('/export')
                ? 'objects.export'
                : req.url.endsWith('/inputs')
                  ? 'objects.inputs'
                  : 'objects.generate',
              context,
            )
            return send(200, { output: result.stdout.trim() })
          }
          if (req.url === '/__atlas/refresh') {
            if (Object.keys(input).length)
              throw new Error('Refresh accepts no inputs')
            await jobs.run('snapshot.capture', context)
            await jobs.run('snapshot.extract', context)
            await compile()
            return send(200, { refreshed: true })
          }
          if (req.url === '/__atlas/export') {
            if (Object.keys(input).length)
              throw new Error('Export accepts no inputs')
            validateDomain(
              'recipes',
              await fs.readFile(
                path.join(root, 'data/authored/recipes.yml'),
                'utf8',
              ),
            )
            await compile()
            await jobs.run('scenario.export', context)
            return send(200, { url: '/generated/create-sky-atlas-patch.zip' })
          }
          const name = req.url.slice('/__atlas/domain/'.length)
          if (
            !req.url.startsWith('/__atlas/domain/') ||
            !domains.includes(name)
          )
            return send(404, { error: 'Unknown domain' })
          if (
            typeof input.text !== 'string' ||
            Buffer.byteLength(input.text) > 1000000
          )
            throw new Error('Invalid source text')
          validateDomain(name, input.text)
          const file = path.join(root, 'data/authored', name + '.yml')
          if ((await fs.realpath(file)) !== file)
            throw new Error('Authored symlinks are not supported')
          const before = await fs.readFile(file, 'utf8')
          if (hash(before) !== input.revision)
            return send(409, {
              error: 'File changed on disk. Reload before saving.',
            })
          await fs.writeFile(file + '.tmp', input.text, { flag: 'wx' })
          try {
            await fs.rename(file + '.tmp', file)
          } catch (error) {
            await fs.unlink(file + '.tmp')
            throw error
          }
          try {
            await compile()
          } catch (error) {
            await fs.writeFile(file, before)
            await compile().catch(() => {})
            throw error
          }
          return send(200, { revision: hash(input.text) })
        } catch (error) {
          send(error.code === 'busy' ? 409 : 400, {
            error: error.message,
            code: error.code,
          })
        } finally {
          if (acquired) busy = false
        }
      })
    },
  }
}
