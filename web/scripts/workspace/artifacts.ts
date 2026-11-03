import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Transform, Readable } from 'node:stream'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  artifactSchema,
  digestSchema,
  scopeSchema,
  type Artifact,
  type Scope,
  assertJson,
} from '../../src/lib/workspace/contracts.ts'
import type { Execution, Registration } from './service.ts'
import { canonical, hash } from './identity.ts'
import { target, scopeKey, type Context, type Grant } from './policy.ts'
import { WorkspaceError } from './errors.ts'
import { ownedDirectory } from './paths.ts'
import { loadedTool } from './loaded-tool.ts'
import {
  artifactFormats as formats,
  generationSchema,
  type Generation,
} from './artifact-records.ts'
import { createArtifactRetention } from './artifact-retention.ts'
import { createInputDigests } from './digests.ts'
const ownRevision = loadedTool(import.meta.url)
const recordsRevision = loadedTool(
  new URL('./artifact-records.ts', import.meta.url).href,
)
const publisherRevision = async () =>
  hash(
    canonical({
      publisher: await ownRevision(),
      records: await recordsRevision(),
    }),
  )

export type { Generation } from './artifact-records.ts'
const inside = (root: string, file: string) => file.startsWith(root + path.sep)
const missing = () => new WorkspaceError('NOT_FOUND', 'Artifact is unavailable')

/** Immutable shared bytes, separately scoped references, active manifest published last. */
export function createArtifactStore(options: {
  root: string
  registrations: Registration[]
  can: (context: Context, grant: Grant) => Promise<boolean>
  now?: () => number
}) {
  const registrations = new Map(
    options.registrations.map((r) => [scopeKey(r.scope), r]),
  )
  const absolute = path.resolve(options.root)
  const anchor = path.parse(absolute).root
  // Construction must not schedule unowned IO (including for denied requests).
  let initializing: Promise<string> | undefined
  const root = () =>
    (initializing ??= ownedDirectory(anchor, path.relative(anchor, absolute)))
  const retention = createArtifactRetention({
    root,
    can: options.can,
    scopes: options.registrations.map((item) => item.scope),
    now: options.now,
  })
  const inputDigests = createInputDigests()
  const generations = new Map<
    string,
    {
      stamp: string
      bytes: number
      value: Generation
      references: Map<string, Artifact>
    }
  >()
  async function directory(relative: string) {
    const base = await root(),
      output = await ownedDirectory(base, relative)
    if ((await fs.realpath(output)) !== output || !inside(base, output))
      throw missing()
    return output
  }
  async function checked(file: string) {
    const base = await root()
    if (!inside(base, file) || (await fs.realpath(file)) !== file)
      throw missing()
    const info = await fs.stat(file)
    if (!info.isFile()) throw missing()
    return info
  }
  function registered(scope: Scope) {
    scopeSchema.parse(scope)
    if (!registrations.has(scopeKey(scope))) throw missing()
  }
  async function allowed(context: Context, scope: Scope, id: string) {
    registered(scope)
    for (const grant of [
      {
        action: 'pack.read' as const,
        target: target(scope, 'pack', scope.packId),
      },
      {
        action: 'artifact.read' as const,
        target: target(scope, 'artifact', id),
      },
    ])
      if (!(await options.can(context, grant))) throw missing()
    await retention.ensure()
  }
  async function json(file: string, limit = 8 * 1024 * 1024) {
    if ((await checked(file)).size > limit) throw missing()
    return JSON.parse(await fs.readFile(file, 'utf8'))
  }
  async function write(file: string, value: unknown) {
    const temporary = file + '.' + randomUUID() + '.tmp'
    try {
      await fs.writeFile(temporary, JSON.stringify(value), { flag: 'wx' })
      // Refuse a symlink destination even though rename would replace the link.
      await fs.lstat(file).then(
        (info) => {
          if (info.isSymbolicLink()) throw missing()
        },
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
        },
      )
      await fs.rename(temporary, file)
    } finally {
      await fs.rm(temporary, { force: true })
    }
  }
  async function referenceGeneration(scope: Scope, reference: Artifact) {
    if (!generationSchema.shape.id.safeParse(reference.generationId).success)
      throw missing()
    const file = path.join(
      await directory('generations/' + scopeKey(scope)),
      reference.generationId + '.json',
    )
    const info = await checked(file),
      stamp = `${info.ino}/${info.size}/${info.mtimeMs}/${info.ctimeMs}`
    let cached = generations.get(file)
    if (!cached || cached.stamp !== stamp) {
      const value = generationSchema.parse(await json(file))
      if (
        value.id !== reference.generationId ||
        scopeKey(value.scope) !== scopeKey(scope)
      )
        throw missing()
      cached = {
        stamp,
        bytes: info.size,
        value,
        references: new Map(
          Object.values(value.files).map((item) => [item.id, item]),
        ),
      }
      generations.set(file, cached)
      while (
        generations.size > 32 ||
        [...generations.values()].reduce((sum, item) => sum + item.bytes, 0) >
          32 * 1024 * 1024
      )
        generations.delete(generations.keys().next().value!)
    }
    if (canonical(cached.references.get(reference.id)) !== canonical(reference))
      throw missing()
  }
  async function active(
    context: Context,
    scope: Scope,
    namespace: string,
    selected?: string,
  ): Promise<Generation | null> {
    registered(scope)
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(namespace)) throw missing()
    for (const grant of [
      {
        action: 'pack.read' as const,
        target: target(scope, 'pack', scope.packId),
      },
      {
        action: 'artifact.read' as const,
        target: target(scope, 'projection', namespace),
      },
    ])
      if (!(await options.can(context, grant))) throw missing()
    await retention.ensure()
    const file = path.join(
      await directory('manifests/' + scopeKey(scope)),
      namespace + '.json',
    )
    try {
      const result = generationSchema.parse(await json(file))
      if (
        scopeKey(result.scope) !== scopeKey(scope) ||
        result.namespace !== namespace
      )
        throw missing()
      const files: Record<string, Artifact> = {}
      for (const [name, reference] of Object.entries(result.files)) {
        if (selected !== undefined && name !== selected) continue
        if (scopeKey(reference.scope) !== scopeKey(scope)) throw missing()
        if (
          await options.can(context, {
            action: 'artifact.read',
            target: target(scope, 'artifact', reference.id),
          })
        )
          files[name] = reference
      }
      if (Object.keys(files).length) retention.lease(scope, result.id)
      return { ...result, files }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }
  async function publish(
    context: Execution,
    input: {
      namespace: string
      staging: string
      files: Record<string, string>
      inputs: Record<string, string>
      recheck: () => Promise<void>
      rewriteJSON?: (
        value: unknown,
        references: Record<string, Artifact>,
        logical: string,
      ) => unknown
      dependencies?: Artifact[]
      jsonMaximum?: 16 | 32
    },
  ): Promise<Generation> {
    registered(context.scope)
    await context.authorize()
    const release = await retention.writer()
    try {
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(input.namespace)) throw missing()
      const staging = await fs.realpath(input.staging)
      const dependencies: Array<{ scope: Scope; generationId: string }> = []
      for (const reference of input.dependencies ?? []) {
        if (scopeKey(reference.scope) !== scopeKey(context.scope))
          throw missing()
        const admitted = await resolve(context, context.scope, reference.id)
        if (
          !dependencies.some(
            (item) => item.generationId === admitted.reference.generationId,
          )
        )
          dependencies.push({
            scope: context.scope,
            generationId: admitted.reference.generationId,
          })
      }
      const id = randomUUID(),
        inputRevision = hash(canonical(input.inputs))
      const files: Record<string, Artifact> = {}
      const rank = (name: string) =>
        !name.endsWith('.json') ? 0 : name === 'index.json' ? 2 : 1
      for (const [logical, source] of Object.entries(input.files).sort(
        ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b),
      )) {
        if (
          !/^[a-zA-Z0-9_.\/-]{1,240}$/.test(logical) ||
          logical
            .split('/')
            .some((part) => part === '.' || part === '..' || !part)
        )
          throw missing()
        const mediaType = formats[path.extname(logical).toLowerCase()]
        if (
          !mediaType ||
          !inside(staging, source) ||
          (await fs.realpath(source)) !== source
        )
          throw missing()
        const info = await fs.stat(source)
        if (!info.isFile() || info.size > 512 * 1024 * 1024) throw missing()
        let rewritten: Buffer | undefined
        if (input.rewriteJSON && logical.endsWith('.json')) {
          const maximum = (input.jsonMaximum ?? 16) * 1024 * 1024
          if (info.size > maximum)
            throw new WorkspaceError(
              'GENERATION_FAILED',
              'Generated JSON exceeds its rewrite limit',
            )
          const value = input.rewriteJSON(
            JSON.parse(await fs.readFile(source, 'utf8')),
            files,
            logical,
          )
          assertJson(value, maximum)
          rewritten = Buffer.from(JSON.stringify(value))
        }
        const expectedSize = rewritten?.byteLength ?? info.size
        const temporary = path.join(await directory('staging'), randomUUID())
        const digest = createHash('sha256')
        let bytes = 0
        try {
          const handle = await fs.open(temporary, 'wx')
          await pipeline(
            rewritten ? Readable.from([rewritten]) : createReadStream(source),
            new Transform({
              transform(chunk, _encoding, next) {
                bytes += chunk.length
                if (bytes > expectedSize) {
                  next(missing())
                  return
                }
                digest.update(chunk)
                next(null, chunk)
              },
            }),
            handle.createWriteStream(),
          )
          if (bytes !== expectedSize)
            throw new WorkspaceError(
              'REVISION_CONFLICT',
              'Generated input changed while publishing',
              'after-refresh',
            )
          const sha256 = digest.digest('hex')
          const blob = path.join(
            await directory('blobs/' + sha256.slice(0, 2)),
            sha256,
          )
          try {
            await fs.copyFile(temporary, blob, fs.constants.COPYFILE_EXCL)
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
            const existing = await inputDigests(blob)
            if (existing.sha256 !== sha256 || existing.byteLength !== bytes)
              throw missing()
          }
          const referenceId = hash(
            canonical({
              scope: context.scope,
              generationId: id,
              logical,
              sha256,
            }),
          )
          const reference = artifactSchema.parse({
            id: referenceId,
            scope: context.scope,
            generationId: id,
            mediaType,
            byteLength: bytes,
            sha256,
            inputRevision,
            url: `/__atlas/workspaces/${context.scope.workspaceId}/packs/${context.scope.packId}/artifacts/${referenceId}`,
          })
          files[logical] = reference
        } finally {
          await fs.rm(temporary, { force: true })
        }
      }
      await input.recheck()
      await context.authorize()
      const generation = generationSchema.parse({
        schema: 1,
        id,
        scope: context.scope,
        namespace: input.namespace,
        inputs: input.inputs,
        inputRevision,
        files,
        publishedAt: new Date(options.now?.() ?? Date.now()).toISOString(),
        dependencies,
      })
      const references = await directory(
        'references/' + scopeKey(context.scope),
      )
      for (const reference of Object.values(files)) {
        await context.authorize()
        await write(path.join(references, reference.id + '.json'), reference)
      }
      // Candidate references are immutable but unreachable from an active manifest
      // until all inputs and authority have been checked again.
      await input.recheck()
      await context.authorize()
      await write(
        path.join(
          await directory('generations/' + scopeKey(context.scope)),
          id + '.json',
        ),
        generation,
      )
      await input.recheck()
      await context.authorize()
      await write(
        path.join(
          await directory('manifests/' + scopeKey(context.scope)),
          input.namespace + '.json',
        ),
        generation,
      )
      context.committed('projection:' + input.namespace, {
        [input.namespace]: inputRevision,
      })
      context.invalidate(
        'projections',
        [
          {
            action: 'artifact.read',
            target: target(context.scope, 'projection', input.namespace),
          },
        ],
        {
          kind: 'published',
          namespace: input.namespace,
          generationId: id,
          inputRevision,
        },
      )
      return generation
    } finally {
      await release()
    }
  }
  async function resolve(context: Context, scope: Scope, id: string) {
    if (!digestSchema.safeParse(id).success) throw missing()
    await allowed(context, scope, id)
    const reference = artifactSchema.parse(
      await json(
        path.join(
          await directory('references/' + scopeKey(scope)),
          id + '.json',
        ),
      ),
    )
    if (
      reference.id !== id ||
      scopeKey(reference.scope) !== scopeKey(scope) ||
      !Object.values(formats).includes(reference.mediaType) ||
      reference.url !==
        `/__atlas/workspaces/${scope.workspaceId}/packs/${scope.packId}/artifacts/${id}`
    )
      throw missing()
    await referenceGeneration(scope, reference)
    retention.lease(scope, reference.generationId)
    const file = path.join(
      await directory('blobs/' + reference.sha256.slice(0, 2)),
      reference.sha256,
    )
    const actual = await inputDigests(file)
    if (
      actual.byteLength !== reference.byteLength ||
      actual.sha256 !== reference.sha256
    )
      throw missing()
    await allowed(context, scope, id)
    return { reference, file }
  }
  async function http(
    context: Context,
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    const pathname = request.url?.split('?')[0] ?? ''
    if (!pathname.startsWith('/__atlas/workspaces/')) return false
    try {
      const match =
        /^\/__atlas\/workspaces\/([a-z0-9][a-z0-9_-]{0,63})\/packs\/([a-z0-9][a-z0-9_-]{0,63})\/artifacts\/([a-f0-9]{64})$/.exec(
          pathname,
        )
      if (!match) throw missing()
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end()
        return true
      }
      const scope = { workspaceId: match[1], packId: match[2] }
      const { reference, file } = await resolve(context, scope, match[3])
      const release = retention.reader(scope, reference.generationId)
      try {
        let start = 0,
          end = reference.byteLength - 1,
          partial = false
        if (request.headers.range) {
          const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
          if (
            !range ||
            (!range[1] && !range[2]) ||
            reference.byteLength === 0
          ) {
            response
              .writeHead(416, {
                'Content-Range': `bytes */${reference.byteLength}`,
              })
              .end()
            return true
          }
          if (!range[1])
            start = Math.max(0, reference.byteLength - Number(range[2]))
          else {
            start = Number(range[1])
            if (range[2]) end = Math.min(end, Number(range[2]))
          }
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= reference.byteLength
          ) {
            response
              .writeHead(416, {
                'Content-Range': `bytes */${reference.byteLength}`,
              })
              .end()
            return true
          }
          partial = true
        }
        response.writeHead(partial ? 206 : 200, {
          'Content-Type': reference.mediaType,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy':
            "default-src 'none'; img-src data:; sandbox",
          'Cache-Control': 'private, no-store',
          'Content-Length': Math.max(0, end - start + 1),
          'Accept-Ranges': 'bytes',
          ...(partial
            ? {
                'Content-Range': `bytes ${start}-${end}/${reference.byteLength}`,
              }
            : {}),
        })
        if (request.method === 'HEAD' || reference.byteLength === 0)
          response.end()
        else await pipeline(createReadStream(file, { start, end }), response)
      } finally {
        await release()
      }
    } catch (error) {
      if (!response.headersSent)
        response
          .writeHead(
            error instanceof WorkspaceError && error.code === 'BUSY'
              ? 503
              : 404,
            { 'Cache-Control': 'no-store' },
          )
          .end()
      else response.destroy()
    }
    return true
  }
  return {
    publish,
    active,
    resolve,
    http,
    revision: publisherRevision,
    manifestPath(scope: Scope, namespace: string) {
      registered(scope)
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(namespace)) throw missing()
      return path.join(
        absolute,
        'manifests',
        scopeKey(scope),
        namespace + '.json',
      )
    },
    generation(context: Context, scope: Scope, namespace: string, id: string) {
      registered(scope)
      return retention.generation(context, scope, namespace, id)
    },
    pin(
      context: Context,
      scope: Scope,
      namespace: string,
      id: string,
      enabled: boolean,
    ) {
      registered(scope)
      return retention.pin(context, scope, namespace, id, enabled)
    },
    prune(context: Execution, scope: Scope, dryRun = true) {
      registered(scope)
      return retention.prune(context, scope, dryRun)
    },
    dispose: retention.dispose,
    recoveryLock(context: Context, scope: Scope) {
      registered(scope)
      return retention.recoveryLock(context, scope)
    },
    recoverLock(context: Execution, scope: Scope, id: string) {
      registered(scope)
      return retention.recoverLock(context, scope, id)
    },
    async withGeneration<T>(
      context: Context,
      scope: Scope,
      namespace: string,
      id: string,
      work: (generation: Generation) => Promise<T>,
    ) {
      registered(scope)
      const generation = await retention.generation(
          context,
          scope,
          namespace,
          id,
        ),
        release = retention.reader(scope, id)
      try {
        return await work(generation)
      } finally {
        await release()
      }
    },
  }
}
