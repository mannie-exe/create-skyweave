import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import YAML from 'yaml'
import { z } from 'zod'
import {
  environmentSchema,
  type Environment,
} from '../../src/lib/workspace/contracts.ts'
import { defineOperation, type Registration, type Resolved } from './service.ts'
import { WorkspaceError } from './errors.ts'
import { canonical, hash } from './identity.ts'
import { scopeKey, target, type Context } from './policy.ts'
import { createInputDigests } from './digests.ts'

const profileSchema = z.strictObject({
  schema: z.literal(1),
  id: z.string(),
  minecraft: z.literal('1.21.1'),
  loader: z.literal('neoforge'),
  resourceFormat: z.literal(34),
  dataFormat: z.literal(48),
})
const runtimeSchema = z.object({
  minecraft: z.string().min(1).max(80),
  loader: z.string().min(1).max(80),
  'loader-version': z.string().min(1).max(80),
})
type Tool = Environment['tools'][number]['id']
export type EnvironmentResolver = ReturnType<typeof createEnvironmentResolver>

/** Metadata reads run no processes. Executable paths remain private to the host. */
export function createEnvironmentResolver(
  registrations: Registration[],
  options: {
    searchPath?: string
    nativeManifest?: (
      registration: Registration,
      context: Context,
    ) => Promise<unknown | null | undefined>
  } = {},
) {
  const registered = new Map(registrations.map((r) => [scopeKey(r.scope), r]))
  const inputDigest = createInputDigests()
  async function bytes(
    file: string,
    optional = false,
    maximum = 8 * 1024 * 1024,
  ) {
    try {
      if ((await fs.realpath(file)) !== file)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Environment source symlinks are not supported',
        )
      const stat = await fs.stat(file)
      if (!stat.isFile() || stat.size > maximum)
        throw new WorkspaceError(
          'INVALID_INPUT',
          'Environment source exceeds its limit',
        )
      return await fs.readFile(file)
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT')
        return null
      throw error
    }
  }
  async function json(file: string, optional = false) {
    const value = await bytes(file, optional)
    return value ? JSON.parse(value.toString('utf8')) : null
  }
  async function executable(file: string) {
    try {
      await fs.access(file, fs.constants.X_OK)
      // Preserve a virtualenv's entry point: resolving its Python symlink would
      // launch the base interpreter without that environment's packages.
      return (await fs.stat(file)).isFile() ? path.resolve(file) : null
    } catch {
      return null
    }
  }
  async function find(program: string) {
    for (const folder of (options.searchPath ?? process.env.PATH ?? '').split(
      path.delimiter,
    )) {
      if (!path.isAbsolute(folder)) continue
      const found = await executable(path.join(folder, program))
      if (found) return found
    }
    return null
  }
  async function resolve(registration: Registration, context?: Context) {
    if (
      registered.get(scopeKey(registration.scope)) !== registration &&
      !registrations.some(
        (r) =>
          r.pack === registration.pack &&
          r.web === registration.web &&
          scopeKey(r.scope) === scopeKey(registration.scope),
      )
    )
      throw new WorkspaceError('NOT_FOUND', 'Environment is unavailable')
    const web = await fs.realpath(registration.web),
      pack = await fs.realpath(registration.pack)
    const [
      intentBytes,
      lockBytes,
      optionsBytes,
      pins,
      objects,
      localDefaults,
      localOverrides,
      profile,
      snapshotBytes,
      complete,
      javaSource,
      exporterSource,
    ] = await Promise.all([
      bytes(path.join(pack, 'empack.yml')),
      bytes(path.join(pack, 'empack.lock')),
      bytes(path.join(pack, 'overrides/client/options.txt'), true),
      json(path.join(pack, 'authoring/visual-patches.json'), true),
      json(path.join(pack, 'authoring/resource-objects.json'), true),
      json(path.join(web, 'data/local.example.json')),
      json(path.join(web, 'data/local.json'), true),
      json(path.join(web, 'profiles/minecraft-1.21.1-neoforge.json')),
      bytes(path.join(web, 'data/generated/runtime/snapshot.json'), true),
      json(path.join(web, 'data/generated/runtime/complete.json'), true),
      bytes(path.join(web, 'tools/resource-exporter/StaticModels.java'), true),
      bytes(path.join(web, 'scripts/export-models.py'), true),
    ])
    // Only the authorized active generation owns native metadata. Missing and denied
    // inputs stay unavailable; stale exporter cache files are never a fallback.
    const native: any =
      context && options.nativeManifest
        ? ((await options.nativeManifest(registration, context)) ?? null)
        : null
    const intent = YAML.parse(intentBytes!.toString('utf8'), {
        maxAliasCount: 20,
      }),
      lock = YAML.parse(lockBytes!.toString('utf8'), { maxAliasCount: 20 })
    const runtime = runtimeSchema.parse(lock.runtime),
      supported = profileSchema.parse(profile)
    const matches =
      runtime.minecraft === supported.minecraft &&
      runtime.loader === supported.loader
    const intentMatchesLock =
      intent.runtime?.minecraft === runtime.minecraft &&
      intent.runtime?.loader?.kind === runtime.loader &&
      intent.runtime?.loader?.pin === runtime['loader-version']
    const configuration = { ...localDefaults, ...localOverrides }
    const configured: Record<string, string> = {}
    for (const key of ['server', 'java', 'vanilla', 'mappedClient']) {
      const value = configuration[key]
      if (value !== undefined) {
        if (
          typeof value !== 'string' ||
          value.length > 4096 ||
          value.includes('\0')
        )
          throw new WorkspaceError(
            'INVALID_INPUT',
            'Invalid local tool configuration',
          )
        configured[key] = path.resolve(
          web,
          value.startsWith('~/')
            ? path.join(os.homedir(), value.slice(2))
            : value,
        )
      }
    }
    const executables: Record<Tool, string | null> = {
      node: await executable(process.execPath),
      python:
        (await executable(path.join(web, '.cache/python/bin/python'))) ??
        (await find('python3')),
      java: configured.java
        ? await executable(path.join(configured.java, 'java'))
        : await find('java'),
      javac: configured.java
        ? await executable(path.join(configured.java, 'javac'))
        : await find('javac'),
      empack:
        (await find('empack')) ??
        (await executable(path.join(os.homedir(), '.local/bin/empack'))),
    }
    const tools = Object.entries(executables).map(([id, file]) => ({
      id: id as Tool,
      available: !!file,
      version: id === 'node' ? process.versions.node : null,
    }))
    const line = optionsBytes
      ?.toString('utf8')
      .split('\n')
      .find((line) => line.startsWith('resourcePacks:'))
    const stack = z
      .array(z.string().max(200))
      .max(500)
      .parse(line ? JSON.parse(line.slice('resourcePacks:'.length)) : [])
    if (
      !stack.every(
        (entry) =>
          ['vanilla', 'fabric', 'mod_resources'].includes(entry) ||
          (/^file\/[^/\\]+$/.test(entry) && !entry.includes('..')) ||
          (/^mod\/[a-z0-9_.-]+:[a-z0-9_/-]+$/.test(entry) &&
            !entry.includes('..')),
      )
    )
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Unsupported resource stack entry',
      )
    const stackRevision = hash(
      canonical({
        stack,
        pins: pins
          ? Object.fromEntries(
              Object.entries(pins.sources ?? {}).map(([id, value]) => {
                const pin = value as Record<string, unknown>
                return [
                  id,
                  {
                    version: pin.version ?? null,
                    sha512: pin.sha512 ?? null,
                    selection: pin.selection ?? 'dependency',
                  },
                ]
              }),
            )
          : null,
      }),
    )
    const dependencies = Object.entries(lock.dependencies ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => {
        const entry = value as {
          selection?: { selection?: { id?: string } }
          files?: Array<{ expected?: { digests?: Record<string, string> } }>
        }
        return {
          id,
          version: entry.selection?.selection?.id ?? null,
          digests: (entry.files ?? []).map(
            (file) => file.expected?.digests ?? {},
          ),
        }
      })
    const snapshot = snapshotBytes
      ? JSON.parse(snapshotBytes.toString('utf8'))
      : null
    const observed =
      snapshot && complete
        ? {
            snapshotId: hash(snapshotBytes!),
            inputSha256: hash(
              canonical({
                mods: snapshot.mods ?? {},
                minecraft: complete.minecraft ?? null,
                lockSha256: snapshot.lockSha256 ?? null,
              }),
            ),
            capturedAt:
              typeof complete.time === 'string' ? complete.time : null,
            minecraft:
              typeof complete.minecraft === 'string'
                ? complete.minecraft
                : null,
            currentLock: snapshot.lockSha256 === hash(lockBytes!),
          }
        : null
    const facts = {
      schema: 1 as const,
      scope: registration.scope,
      selected: {
        minecraft: runtime.minecraft,
        loader: { id: runtime.loader, version: runtime['loader-version'] },
        lockSha256: hash(lockBytes!),
        intentMatchesLock,
      },
      dependencies,
      resources: {
        profileId: matches ? supported.id : null,
        packFormat: matches ? supported.resourceFormat : null,
        dataFormat: matches ? supported.dataFormat : null,
        stackRevision,
        stack,
      },
      observed,
      tools,
    }
    const baseline = hash(canonical({ runtime, profile: supported }))
    type Capability = Environment['capabilities'][number]
    const capabilities: Capability[] = []
    function capability(
      id: string,
      adapter: string,
      needed: Tool[],
      reason: string,
      state: Capability['state'] = 'supported',
      evidence: Capability['evidence'] = 'inspected',
      inputs: unknown = {},
    ) {
      const missing = needed.filter((tool) => !executables[tool])
      capabilities.push({
        id,
        adapter,
        adapterVersion: 1,
        state: !matches
          ? 'unsupported'
          : !intentMatchesLock
            ? 'stale'
            : missing.length
              ? 'unavailable'
              : state,
        evidence,
        inputRevision: hash(canonical({ baseline, id, inputs })),
        reason: !matches
          ? 'This adapter supports Minecraft 1.21.1 / NeoForge.'
          : !intentMatchesLock
            ? 'Runtime intent differs from the recorded lock.'
            : missing.length
              ? 'Required tool unavailable: ' + missing.join(', ')
              : reason,
      })
    }
    capability(
      'block-models',
      'vanilla-block-json',
      [],
      'Static JSON models and declared transforms; dynamic block behavior is not simulated.',
      'supported',
      'inspected',
      { stackRevision },
    )
    capability(
      'texture-frames',
      'minecraft-texture-frames',
      [],
      'Declared frames and timing; model animations and audio are not evaluated.',
    )
    capability(
      'quests',
      'ftb-quests',
      ['python'],
      'Validates authored FTB quest sources; generation remains explicit.',
      'supported',
      'inspected',
      {
        ftbquests:
          dependencies.find((entry) => entry.id === 'ftb-quests') ?? null,
      },
    )
    capability(
      'resource-authoring',
      'selected-resource-generation',
      ['python', 'empack'],
      'Generation verifies pinned archives and the inspected empack manifest contract; it does not install output.',
      'supported',
      'inspected',
      { stackRevision },
    )
    capability(
      'empack-inspection',
      'empack-manifest-0.8.2',
      ['empack'],
      'Uses the inspected manifest machine-output contract. Tool availability is not a version check.',
    )
    capability(
      'runtime',
      'neoforge-runtime-export',
      ['java', 'javac', 'python', 'node'],
      'Capture uses an isolated runtime. Existing survey data is not recaptured automatically.',
      observed &&
        (!observed.currentLock || observed.minecraft !== runtime.minecraft)
        ? 'stale'
        : 'supported',
      observed ? 'runtime' : 'inspected',
      { observed: observed?.inputSha256 ?? null },
    )
    const nativeCodeCurrent =
      native &&
      javaSource &&
      exporterSource &&
      native.sourceSha256 === hash(javaSource) &&
      native.exporterSha256 === hash(exporterSource) &&
      native.minecraft === runtime.minecraft &&
      native.loader === runtime['loader-version']
    const mapped =
      configured.mappedClient ??
      path.join(pack, '.cache/resource-inputs/mapped-client.jar')
    let mappedHash: string | null = null
    try {
      mappedHash = (await inputDigest(await fs.realpath(mapped))).sha256
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const modelInputsAvailable = !!mappedHash
    const nativeCurrent =
      nativeCodeCurrent && native.mappedClientSha256 === mappedHash
    const staticState = !modelInputsAvailable
      ? 'unavailable'
      : nativeCurrent
        ? 'supported'
        : 'stale'
    capability(
      'static-entities',
      'minecraft-static-factories',
      ['java', 'javac', 'python', 'node'],
      !modelInputsAvailable
        ? 'The mapped client input is unavailable.'
        : nativeCurrent
          ? 'Registered factories only; feature renderers and runtime poses need an admitted adapter.'
          : 'Export static models for the current source and runtime.',
      staticState,
      'inspected',
      {
        native: native
          ? {
              source: native.sourceSha256 ?? null,
              mapped: native.mappedClientSha256 ?? null,
              exporter: native.exporterSha256 ?? null,
            }
          : null,
        source: javaSource ? hash(javaSource) : null,
        exporter: exporterSource ? hash(exporterSource) : null,
        mapped: mappedHash,
      },
    )
    capability(
      'cem-static',
      'emf-static-inspection',
      ['java', 'javac', 'python', 'node'],
      'Only declared CEM factories and fixed inspection poses; expressions, random skins and full animations remain unsupported.',
      staticState,
      'inspected',
      {
        entities: objects?.entities ?? [],
        native: native?.cemInputSha256 ?? null,
      },
    )
    const fusion = dependencies.some(
      (entry) => entry.id === 'fusion-connected-textures',
    )
    capability(
      'fusion',
      'fusion-selected-overrides',
      [],
      'Selected override layers and inspected model rules; installed Fusion alone does not imply complete browser emulation.',
      fusion ? 'supported' : 'unavailable',
      'inspected',
      { fusion },
    )
    const confectionery = dependencies.find(
      (entry) => entry.id === 'create-confectionery',
    )
    const optionalDigests =
      native?.optionalDigests?.['create-confectionery'] ?? {}
    const optionalCurrent =
      confectionery &&
      confectionery.digests.length > 0 &&
      confectionery.digests.every(
        (digests) =>
          Object.keys(digests).length > 0 &&
          Object.entries(digests).every(
            ([algorithm, digest]) => optionalDigests[algorithm] === digest,
          ),
      )
    capability(
      'confectionery-static',
      'confectionery-static-factory',
      ['java', 'javac', 'python', 'node'],
      confectionery
        ? 'Optional gingerbread factory; its locked artifact is verified when exporting.'
        : 'Confectionery is not selected.',
      confectionery
        ? staticState === 'supported' && !optionalCurrent
          ? 'stale'
          : staticState
        : 'unavailable',
      'inspected',
      {
        dependency:
          dependencies.find((entry) => entry.id === 'create-confectionery') ??
          null,
      },
    )
    // Timestamps, workstation paths and local filesystem observations do not define portable identity.
    const revision = hash(
      canonical({
        ...facts,
        observed: observed
          ? {
              inputSha256: observed.inputSha256,
              currentLock: observed.currentLock,
            }
          : null,
        capabilities,
      }),
    )
    return {
      manifest: environmentSchema.parse({ ...facts, capabilities, revision }),
      trusted: {
        web,
        pack,
        configured,
        executables,
        profile: matches ? supported : null,
        lock,
      },
    }
  }
  return { resolve }
}

export function environmentDefinitions(resolver: EnvironmentResolver) {
  const grants = (ctx: Resolved) => [
    {
      action: 'environment.read' as const,
      target: target(ctx.scope, 'environment', 'current'),
    },
  ]
  return [
    defineOperation({
      name: 'environment.read',
      effect: 'query',
      input: z.strictObject({}),
      output: environmentSchema,
      label: 'Read environment',
      href: '/',
      success: '',
      targets: grants,
      resultTargets: grants,
      execute: async (ctx) =>
        (await resolver.resolve(ctx.registration, ctx)).manifest,
    }),
  ]
}
