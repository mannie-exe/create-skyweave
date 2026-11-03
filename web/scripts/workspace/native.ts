import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { createJobRunner, jobRegistry } from '../jobs.mjs'
import type { Execution, Registration } from './service.ts'
import { scopeKey } from './policy.ts'
import { WorkspaceError } from './errors.ts'
import { ownedDirectory } from './paths.ts'
import { boundedText } from '../../src/lib/workspace/contracts.ts'
import type { EnvironmentResolver } from './environment.ts'
import { operationOwner } from './ownership.ts'

export type NativeExecutor = ReturnType<typeof createNativeExecutor>
/** One owned native slot, independent of sockets and per-pack mutation leases. */
export function createNativeExecutor(options: {
  session: () => string
  runner?: ReturnType<typeof createJobRunner>
  environment?: EnvironmentResolver
}) {
  const runner = options.runner ?? createJobRunner()
  let owner: { scope: string; operationId: string; jobId?: string } | undefined
  let closed = false
  function available() {
    if (closed)
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'The native executor is stopped',
        'reconnect',
      )
    if (owner || runner.snapshot().current)
      throw new WorkspaceError(
        'BUSY',
        'Another native job is running',
        'after-idle',
      )
  }
  function redact(
    text: string,
    registration: Registration,
    directories: Record<string, string>,
  ) {
    let value = text
    for (const root of [
      ...Object.values(directories),
      registration.web,
      registration.pack,
      os.homedir(),
    ].sort((a, b) => b.length - a.length))
      if (root.length > 1) value = value.split(root).join('[workspace]')
    return value
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
  }
  async function run(
    context: Execution,
    name: string,
    input: object = {},
    directories: Record<string, string> = {},
  ) {
    if (!context.operationId)
      throw new WorkspaceError(
        'INVALID_INPUT',
        'Queries cannot start native jobs',
      )
    available()
    const admitted = (owner = {
      scope: scopeKey(context.scope),
      operationId: context.operationId,
      jobId: undefined as string | undefined,
    })
    let marker: string | undefined,
      invocation: string | undefined,
      unsubscribe = () => {}
    let work: ReturnType<typeof runner.run> | undefined
    let redactions = directories
    try {
      await context.authorize()
      const environment = await options.environment?.resolve(
        context.registration,
        context,
      )
      const definition = jobRegistry[name as keyof typeof jobRegistry]
      if (environment) {
        redactions = {
          ...directories,
          ...environment.trusted.configured,
          ...Object.fromEntries(
            Object.entries(environment.trusted.executables).filter(
              (entry): entry is [string, string] => !!entry[1],
            ),
          ),
        }
        const capability =
          'capability' in (definition ?? {})
            ? environment.manifest.capabilities.find(
                (capability) =>
                  capability.id ===
                  (definition as { capability: string }).capability,
              )
            : undefined
        if ('capability' in (definition ?? {}) && !capability)
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            'This job has no supported environment adapter.',
            'after-refresh',
          )
        if (
          capability &&
          (!environment.manifest.selected.intentMatchesLock ||
            ['unavailable', 'unsupported'].includes(capability.state))
        )
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            capability.reason,
            'after-refresh',
          )
        if (
          definition?.program === 'python3' &&
          !environment.trusted.executables.python
        )
          throw new WorkspaceError(
            'CAPABILITY_UNAVAILABLE',
            'Python is unavailable.',
            'after-refresh',
          )
      }
      const root = await ownedDirectory(
        await fs.realpath(context.registration.web),
        path.join('.cache/workspace', admitted.scope, 'processes'),
      )
      marker = path.join(root, randomUUID() + '.json')
      const record = {
        owner: operationOwner(context.scope, {
          ...context,
          session: options.session(),
        }),
        schema: 1,
        session: options.session(),
        scope: context.scope,
        operationId: context.operationId,
        name,
        parentPid: process.pid,
        startedAt: new Date().toISOString(),
        ...(environment
          ? { environmentRevision: environment.manifest.revision }
          : {}),
      }
      await fs.writeFile(marker, JSON.stringify(record), {
        flag: 'wx',
        flush: true,
      })
      if (environment) {
        invocation = marker.replace(/\.json$/, '.context.json')
        await fs.writeFile(
          invocation,
          JSON.stringify({
            schema: 1,
            scope: context.scope,
            web: context.registration.web,
            pack: context.registration.pack,
            paths: environment.trusted.configured,
            tools: environment.trusted.executables,
            environment: environment.manifest,
          }),
          { flag: 'wx', mode: 0o600, flush: true },
        )
      }
      await context.authorize()
      if (runner.snapshot().current)
        throw new WorkspaceError(
          'BUSY',
          'Another native job is running',
          'after-idle',
        )
      unsubscribe = runner.subscribe(
        (snapshot: ReturnType<typeof runner.snapshot>) => {
          const job = snapshot.current ?? snapshot.last
          if (
            !job ||
            job.name !== name ||
            (admitted.jobId && admitted.jobId !== job.id)
          )
            return
          admitted.jobId = job.id
          context.observe({
            id: job.id,
            name: job.name,
            state: job.state,
            cancellable: !!job.cancellable,
            ...(job.diagnostic
              ? {
                  diagnostic: redact(
                    job.diagnostic,
                    context.registration,
                    redactions,
                  ).slice(-16000),
                }
              : {}),
          })
        },
      )
      work = runner.run(
        name,
        {
          web: context.registration.web,
          pack: context.registration.pack,
          ...directories,
          ...(environment ? { tools: environment.trusted.executables } : {}),
          ...(invocation ? { invocation } : {}),
        },
        input,
      )
      // Attach rejection immediately; marker IO must not create an unhandled rejection.
      void work.catch(() => {})
      const processRecord = runner.ownedProcess()
      if (processRecord?.pid) {
        const temporary = marker + '.tmp'
        try {
          await fs.writeFile(
            temporary,
            JSON.stringify({
              ...record,
              jobId: processRecord.id,
              pid: processRecord.pid,
              ...(process.platform !== 'win32'
                ? { groupId: processRecord.pid }
                : {}),
            }),
            { flag: 'wx', flush: true },
          )
          await fs.rename(temporary, marker)
        } finally {
          await fs.rm(temporary, { force: true })
        }
      }
      return (await work) as { stdout: string; stderr: string; code: number }
    } catch (error) {
      if (
        work &&
        admitted.jobId &&
        runner.snapshot().current?.id === admitted.jobId
      ) {
        // A failed ownership write cannot leave a worker running unaccounted for.
        closed = true
        await runner.shutdown()
      }
      if (error instanceof WorkspaceError) throw error
      const value = error as Error & { code?: string }
      if (value.code === 'cancelled')
        throw new WorkspaceError('CANCELLED', 'Job cancelled', 'never')
      if (value.code === 'interrupted')
        throw new WorkspaceError(
          'OUTCOME_UNKNOWN',
          'The native job was interrupted; inspect its saved results.',
          'inspect-outcome',
        )
      if (value.code === 'busy')
        throw new WorkspaceError(
          'BUSY',
          'Another native job is running',
          'after-idle',
        )
      const diagnostic = redact(
        value.message ?? 'Native execution failed',
        context.registration,
        redactions,
      )
      const lines = diagnostic.trim().split('\n')
      // Node appends its version after the exception; Python puts it last.
      const message = (
        lines.findLast((line) => /^[\w.]*Error:\s/.test(line)) ??
        lines.findLast((line) => line.trim() && !/^Node\.js v\d/.test(line)) ??
        'Native execution failed'
      ).replace(/^[\w.]*Error:\s*/, '')
      throw new WorkspaceError(
        'GENERATION_FAILED',
        boundedText(message, 4096),
        'after-refresh',
        { diagnostic: diagnostic.slice(-16000) },
      )
    } finally {
      unsubscribe()
      try {
        if (invocation) await fs.rm(invocation, { force: true })
        if (marker) await fs.rm(marker, { force: true })
      } finally {
        if (owner === admitted) owner = undefined
      }
    }
  }
  async function cancel(context: Execution, operationId: string) {
    await context.authorize()
    const job = runner.snapshot().current
    if (
      !owner ||
      owner.scope !== scopeKey(context.scope) ||
      owner.operationId !== operationId ||
      !job ||
      !job.cancellable
    )
      throw new WorkspaceError(
        'CANCEL_NOT_SUPPORTED',
        'This operation cannot be cancelled',
      )
    runner.cancel(job.id)
    return { requested: true }
  }
  return {
    available,
    run,
    cancel,
    runner,
    async dispose() {
      closed = true
      await runner.shutdown()
    },
  }
}
