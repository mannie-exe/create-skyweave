import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createArtifactStore, type Generation } from './artifacts.ts'
import { artifactFormats } from './artifact-records.ts'
import {
  artifactSchema,
  type Artifact,
} from '../../src/lib/workspace/contracts.ts'
import { admitDelivery, openPolicy, scopeKey, type Policy } from './policy.ts'
import { canonical, hash } from './identity.ts'
import { ownedDirectory } from './paths.ts'
import type { Registration } from './service.ts'
import { WorkspaceError } from './errors.ts'
import { MAP_JSON_LIMIT_MIB } from './asset-projection.ts'

const publicNames = {
  map: /^(?:(?:catalog|domains|routes|coverage|recipes|loot|world|structures|islands|authored)\.json|details\/[a-z0-9_/-]+\.json|icons\/[a-f0-9]+\.(?:png|svg))$/,
  objects:
    /^(?:index\.json|previews\/[a-f0-9]{64}\.json|textures\/[a-f0-9]{64}\.png)$/,
  'texture-resources': /^(?:index\.json|[a-z0-9_-]+\.png)$/,
} as const
export type PublicNamespace = keyof typeof publicNames
const extension = new Map(
  Object.entries(artifactFormats).map(([ext, type]) => [type, ext]),
)
const changed = () =>
  new Error(
    'Workspace projections changed during the static build; build again.',
  )

/** Explicitly public projection bytes only. Native inputs, contexts and jobs are never exported. */
export async function materializeStatic(options: {
  registration: Registration
  output: string
  namespaces: PublicNamespace[]
  policy?: Policy
  expectedHeads?: Record<string, string | null>
  recheck?: () => Promise<void>
}) {
  const policy = options.policy ?? openPolicy
  admitDelivery('open-static', policy)
  const registration = options.registration,
    scope = registration.scope,
    actor = {
      principal: { kind: 'anonymous' as const, id: 'static-build' },
      connectionId: randomUUID(),
    }
  if (
    new Set(options.namespaces).size !== options.namespaces.length ||
    options.namespaces.some((name) => !Object.hasOwn(publicNames, name))
  )
    throw new Error('Unsupported public projection')
  const output = await fs.realpath(options.output)
  // Only the build output may be replaced. Never materialize over a live source/cache root.
  if (
    output === registration.web ||
    output === registration.pack ||
    registration.web.startsWith(output + path.sep) ||
    output.startsWith(path.join(registration.web, 'public') + path.sep) ||
    output === path.join(registration.web, 'public')
  )
    throw new Error('Static output must be a separate build directory')
  const store = createArtifactStore({
    root: path.join(registration.web, '.cache/workspace/artifacts'),
    registrations: [registration],
    can: async (ctx, grant) =>
      (await policy.decide(ctx, grant.action, grant.target)).allowed,
  })
  const stage = await ownedDirectory(output, '.atlas-static-' + randomUUID())
  try {
    const selected: Generation[] = []
    for (const namespace of options.namespaces) {
      const generation = await store.active(actor, scope, namespace)
      if (
        options.expectedHeads &&
        (generation?.id ?? null) !== options.expectedHeads[namespace]
      )
        throw changed()
      if (generation) selected.push(generation)
    }
    const queue: Array<{ id: string; namespace?: string }> = selected.map(
        (value) => ({ id: value.id, namespace: value.namespace }),
      ),
      seen = new Set(queue.map((value) => value.id)),
      admitted: Generation[] = []
    async function held(index: number): Promise<unknown> {
      const item = queue[index]
      if (!item) return write()
      for (const namespace of item.namespace
        ? [item.namespace]
        : options.namespaces) {
        let matched = false
        try {
          return await store.withGeneration(
            actor,
            scope,
            namespace,
            item.id,
            async (current) => {
              matched = true
              const active = selected.find((value) => value.id === current.id)
              if (active && canonical(current) !== canonical(active))
                throw changed()
              admitted.push(current)
              for (const dependency of current.dependencies) {
                if (scopeKey(dependency.scope) !== scopeKey(scope))
                  throw new Error('Invalid public dependency scope')
                if (!seen.has(dependency.generationId)) {
                  if (queue.length >= 100)
                    throw new Error('Static dependency count exceeds its limit')
                  seen.add(dependency.generationId)
                  queue.push({ id: dependency.generationId })
                }
              }
              return held(index + 1)
            },
          )
        } catch (error) {
          if (
            matched ||
            item.namespace ||
            !(error instanceof WorkspaceError) ||
            error.code !== 'NOT_FOUND'
          )
            throw error
        }
      }
      // A native-input dependency is not public content. Links to it still fail below.
      return held(index + 1)
    }
    async function write() {
      const references = new Map<string, Artifact>(),
        aliases = new Map<string, Artifact>(),
        mapReferences = new Set<string>()
      for (const generation of admitted)
        for (const [logical, reference] of Object.entries(generation.files)) {
          const namespace = generation.namespace as PublicNamespace
          if (
            !publicNames[namespace].test(logical) ||
            logical.split('/').some((part) => part === '..')
          )
            throw new Error('Unadmitted file in public projection')
          if (scopeKey(reference.scope) !== scopeKey(scope))
            throw new Error('Invalid public artifact scope')
          references.set(reference.url, reference)
          if (namespace === 'map') mapReferences.add(reference.url)
          if (selected.some((value) => value.id === generation.id))
            aliases.set(
              '/generated/' +
                (namespace === 'map' ? '' : namespace + '/') +
                logical,
              reference,
            )
        }
      if (references.size > 10000)
        throw new Error('Static artifact count exceeds its limit')
      const converted = new Map<string, Artifact>(),
        visiting = new Set<string>()
      let total = 0
      async function convert(reference: Artifact): Promise<Artifact> {
        const known = converted.get(reference.id)
        if (known) return known
        if (visiting.has(reference.id))
          throw new Error('Cyclic public artifact references')
        visiting.add(reference.id)
        const resolved = await store.resolve(actor, scope, reference.id)
        if (canonical(resolved.reference) !== canonical(reference))
          throw new Error('Public reference changed')
        if (
          reference.byteLength >
          (reference.mediaType === 'application/json'
            ? mapReferences.has(reference.url)
              ? MAP_JSON_LIMIT_MIB
              : 32
            : 16) *
            1024 *
            1024
        )
          throw new Error('Public artifact exceeds its limit')
        let data = await fs.readFile(resolved.file)
        async function rewrite(value: unknown): Promise<unknown> {
          if (typeof value === 'string') {
            const target = references.get(value) ?? aliases.get(value)
            if (target) return (await convert(target)).url
            if (
              value.startsWith('/__atlas/') ||
              value.startsWith('/generated/')
            )
              throw new Error(
                'Public projection contains an unadmitted resource link',
              )
            return value
          }
          if (Array.isArray(value)) {
            const result = []
            for (const child of value) result.push(await rewrite(child))
            return result
          }
          if (value && typeof value === 'object') {
            const artifact = artifactSchema.safeParse(value)
            if (artifact.success) {
              const target = references.get(artifact.data.url)
              if (!target || canonical(target) !== canonical(artifact.data))
                throw new Error('Unadmitted public artifact descriptor')
              return convert(target)
            }
            const result: Record<string, unknown> = {}
            for (const [key, child] of Object.entries(value))
              result[key] = await rewrite(child)
            return result
          }
          return value
        }
        if (reference.mediaType === 'application/json')
          data = Buffer.from(
            JSON.stringify(await rewrite(JSON.parse(data.toString('utf8')))),
          )
        total += data.length
        if (total > 768 * 1024 * 1024)
          throw new Error('Static projection exceeds its byte limit')
        const ext = extension.get(reference.mediaType)
        if (!ext) throw new Error('Unsupported public artifact format')
        const sha256 = hash(data),
          url = `/workspace-snapshot/${scope.workspaceId}/${scope.packId}/assets/${reference.id}-${sha256}${ext}`,
          file = path.join(stage, url)
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, data, { flag: 'wx' })
        const result = { ...reference, url, sha256, byteLength: data.length }
        converted.set(reference.id, result)
        visiting.delete(reference.id)
        return result
      }
      for (const reference of references.values()) await convert(reference)
      for (const [alias, reference] of aliases) {
        const result = converted.get(reference.id)!,
          file = path.join(stage, alias)
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.copyFile(path.join(stage, result.url), file)
      }
      const manifest = {
        schema: 1,
        delivery: 'open-static',
        public: true,
        scope,
        createdAt: new Date().toISOString(),
        dependencies: admitted
          .filter(
            (generation) =>
              !selected.some((value) => value.id === generation.id),
          )
          .map((generation) => ({
            namespace: generation.namespace,
            generationId: generation.id,
            inputRevision: generation.inputRevision,
          })),
        projections: Object.fromEntries(
          selected.map((generation) => [
            generation.namespace,
            {
              generationId: generation.id,
              inputRevision: generation.inputRevision,
              inputs: generation.inputs,
              files: Object.fromEntries(
                Object.entries(generation.files).map(([name, reference]) => [
                  name,
                  converted.get(reference.id),
                ]),
              ),
            },
          ]),
        ),
        unavailable: options.namespaces.filter(
          (name) => !selected.some((value) => value.namespace === name),
        ),
      }
      await fs.mkdir(path.join(stage, 'workspace-snapshot'), {
        recursive: true,
      })
      await fs.writeFile(
        path.join(stage, 'workspace-snapshot/manifest.json'),
        JSON.stringify(manifest),
      )
      for (const namespace of options.namespaces) {
        const current = await store.active(actor, scope, namespace)
        if (
          current?.id !==
          selected.find((value) => value.namespace === namespace)?.id
        )
          throw changed()
      }
      await options.recheck?.()
      // Astro has already copied public/. Replace its legacy projections, preserving reviewed media only.
      const generated = await ownedDirectory(output, 'generated')
      for (const entry of await fs.readdir(generated)) {
        if (entry === 'resource-review' || entry === 'design-preview') continue
        await fs.rm(path.join(generated, entry), {
          recursive: true,
          force: true,
        })
      }
      await fs.rm(path.join(output, 'workspace-snapshot'), {
        recursive: true,
        force: true,
      })
      await fs.rename(
        path.join(stage, 'workspace-snapshot'),
        path.join(output, 'workspace-snapshot'),
      )
      await fs
        .cp(path.join(stage, 'generated'), generated, { recursive: true })
        .catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT' || aliases.size) throw error
        })
      return manifest
    }
    return await held(0)
  } finally {
    await fs.rm(stage, { recursive: true, force: true })
    await store.dispose()
  }
}
