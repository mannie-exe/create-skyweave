import fs from 'node:fs/promises'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import {
  createWorkspaceService,
  defineOperation,
  type Registration,
} from './service.ts'
import { mapDefinitions } from './map.ts'
import { mapProjectionDefinitions } from './map-projection.ts'
import { createArtifactStore } from './artifacts.ts'
import { artifactSchema } from '../../src/lib/workspace/contracts.ts'
import { attachWorkspaceTransport, localRequest } from './transport.ts'
import { WorkspaceError } from './errors.ts'
import { createNativeExecutor } from './native.ts'
import { journalDefinitions } from './journal.ts'
import { auditDefinitions } from './audit.ts'
import { modelDefinitions } from './models.ts'
import { objectDefinitions } from './objects.ts'
import { reviewDefinitions } from './reviews.ts'
import { textureDefinitions } from './textures.ts'
import { snapshotDefinitions } from './snapshot.ts'
import {
  createEnvironmentResolver,
  environmentDefinitions,
} from './environment.ts'
import { artifactRead, target, type Context } from './policy.ts'
import {
  createWorkspaceInventory,
  inventoryDefinitions,
  projectionNamespaces,
} from './inventory.ts'
import { createWorkspaceWatch } from './watch.ts'
import { artifactMaintenanceDefinitions } from './maintenance.ts'
import { recoveryDefinitions } from './recovery.ts'
import { projectionAlias } from './delivery.ts'

/** Trusted local registration, shared by HTTP and socket adapters. */
export function createWorkspaceRuntime(options: {
  web: string
  pack: string
  watch?: boolean
}) {
  const scope = { workspaceId: 'local', packId: 'create_sky' }
  const registration: Registration = {
    scope,
    web: options.web,
    pack: options.pack,
  }
  let service: ReturnType<typeof createWorkspaceService>
  let changes: ReturnType<typeof createWorkspaceWatch> | undefined
  const inventory = createWorkspaceInventory()
  const artifacts = createArtifactStore({
    root: path.join(options.web, '.cache/workspace/artifacts'),
    registrations: [registration],
    can: (context, grant) => service.can(context, grant),
  })
  const environments = createEnvironmentResolver([registration], {
    async nativeManifest(registration, context) {
      try {
        const current = await artifacts.active(
          context,
          registration.scope,
          'native-models',
          'inputs.json',
        )
        if (!current) return undefined
        const metadata = current.files['inputs.json']
        if (!metadata || metadata.byteLength > 8 * 1024 * 1024) return null
        const resolved = await artifacts.resolve(
          context,
          registration.scope,
          metadata.id,
        )
        return JSON.parse(await fs.readFile(resolved.file, 'utf8'))
      } catch (error) {
        if (error instanceof WorkspaceError && error.code === 'NOT_FOUND')
          return null
        throw error
      }
    },
  })
  const native = createNativeExecutor({
    session: () => service.session,
    environment: environments,
  })
  service = createWorkspaceService({
    registrations: [registration],
    definitions: [
      ...artifactMaintenanceDefinitions(artifacts),
      ...recoveryDefinitions([registration], {
        can: (ctx, grant) => service.can(ctx, grant),
        session: () => service.session,
        running: (scope, id) => service.operationRunning(scope, id),
        artifacts,
      }),
      ...inventoryDefinitions(
        inventory,
        artifacts,
        (registration) =>
          changes?.status(registration) ?? {
            monitoring: 'starting',
            restartRequired: false,
          },
      ),
      ...mapDefinitions([registration]),
      ...mapProjectionDefinitions(artifacts, native),
      ...journalDefinitions([registration], native, artifacts),
      ...auditDefinitions(native, artifacts),
      ...modelDefinitions([registration], native, artifacts),
      ...reviewDefinitions([registration]),
      ...environmentDefinitions(environments),
      ...objectDefinitions([registration], native, artifacts, environments),
      ...textureDefinitions([registration], native, artifacts, environments),
      ...snapshotDefinitions([registration], native, artifacts, environments),
      defineOperation({
        name: 'operation.cancel',
        effect: 'control',
        input: z.strictObject({ id: z.uuid() }),
        output: z.strictObject({ requested: z.literal(true) }),
        label: 'Cancel operation',
        href: '/',
        success: 'Cancellation requested.',
        targets: (ctx, input) => [
          {
            action: 'operation.cancel',
            target: target(ctx.scope, 'operation', input.id),
          },
        ],
        async execute(ctx, input) {
          await service.query(ctx, ctx.scope, 'operation.read', {
            id: input.id,
          })
          return native.cancel(ctx, input.id)
        },
      }),
      defineOperation({
        name: 'projection.read',
        effect: 'query',
        input: z.strictObject({
          namespace: z.enum(projectionNamespaces),
          name: z.string().max(240),
        }),
        output: artifactSchema,
        resultTargets: (_ctx, value) => [artifactRead(value)],
        label: 'Read projection',
        href: '/',
        success: '',
        targets: (ctx, input) => [
          {
            action: 'artifact.read',
            target: target(ctx.scope, 'projection', input.namespace),
          },
        ],
        async execute(ctx, input) {
          const generation = await artifacts.active(
            ctx,
            ctx.scope,
            input.namespace,
            input.name,
          )
          const reference = generation?.files[input.name]
          if (!reference)
            throw new WorkspaceError('NOT_FOUND', 'Projection is unavailable')
          return reference
        },
      }),
    ],
    guard: (ctx) => changes?.guard(ctx.registration),
    shutdown: async () => {
      await changes?.dispose()
      await native.dispose()
    },
  })
  if (options.watch)
    changes = createWorkspaceWatch({
      registrations: [registration],
      inventory,
      service,
      manifestPath: (registration, namespace) =>
        artifacts.manifestPath(registration.scope, namespace),
    })
  return {
    service,
    artifacts,
    scope,
    async dispose() {
      await service.dispose()
      await artifacts.dispose()
    },
  }
}

/** Attach the same runtime to the local Vite HTTP host. */
export function createLocalWorkspace(options: {
  server: Server
  web: string
  pack: string
  origins: () => string[]
}) {
  const runtime = createWorkspaceRuntime({ ...options, watch: true })
  const { service, artifacts, scope } = runtime
  const transport = attachWorkspaceTransport({
    ...options,
    service,
    scope,
    mode: 'open-local',
    async snapshot(context, requested, topic) {
      if (topic === 'activity')
        return service.queryDelivery(context, requested, 'activity.read', {})
      if (topic === 'sources')
        return service.queryDelivery(
          context,
          requested,
          'sources.inventory',
          {},
        )
      if (topic === 'environment')
        return service.queryDelivery(context, requested, 'environment.read', {})
      if (topic === 'projections') {
        return service.queryDelivery(
          context,
          requested,
          'projections.inventory',
          {},
        )
      }
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'This topic is not available yet',
      )
    },
  })
  return {
    service,
    async http(request: IncomingMessage, response: ServerResponse) {
      const pathname = request.url?.split('?')[0] ?? ''
      if (
        !pathname.startsWith('/__atlas/') &&
        !pathname.startsWith('/generated/')
      )
        return false
      if (!localRequest(request, options.origins())) {
        response.writeHead(403).end()
        return true
      }
      const context: Context = {
        principal: { kind: 'anonymous', id: 'local-open' },
        connectionId: randomUUID(),
      }
      if (await transport.http(request, response)) return true
      if (await artifacts.http(context, request, response)) return true
      if (await projectionAlias(artifacts, context, scope, request, response))
        return true
      return transport.http(request, response)
    },
    scope,
    async dispose() {
      transport.dispose()
      await runtime.dispose()
    },
  }
}
