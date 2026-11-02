import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const empty = (input) => {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length
  )
    throw new Error('This job accepts no inputs')
}
const documentInput = (input) => {
  if (
    !input ||
    Object.keys(input).join() !== 'document' ||
    !input.document ||
    typeof input.document !== 'object' ||
    Array.isArray(input.document) ||
    Buffer.byteLength(JSON.stringify(input.document)) > 1000000
  )
    throw new Error('Expected a model document of at most 1 MB')
}
const python = (script, cwd, outputs, options = {}) => ({
  program: 'python3',
  script,
  cwd,
  outputs,
  args: [],
  validate: empty,
  inputs: 'none',
  timeoutMs: 30000,
  maxBytes: 2 * 1024 * 1024,
  cancellable: false,
  ...options,
})

// Only repository code supplies execution context. Browser input never supplies
// programs, arguments, working directories or paths to scripts.
export const jobRegistry = Object.freeze({
  'resources.media': {
    program: process.execPath,
    script: 'collect-resource-media.mjs',
    cwd: 'web',
    outputs: ['public/generated/resource-review'],
    args: [],
    validate: empty,
    inputs: 'none',
    timeoutMs: 30000,
    maxBytes: 2 * 1024 * 1024,
    cancellable: true,
  },
  'journal.preview': python(
    'generate-journal.py',
    'pack',
    ['JSON journal diff'],
    { args: ['--preview'], cancellable: true },
  ),
  'journal.validate': python(
    'generate-journal.py',
    'validation',
    ['JSON journal diff'],
    { args: ['--preview'], cancellable: true },
  ),
  'journal.generate': python('generate-journal.py', 'pack', [
    'config/questlog',
    'pack-fixes/assets/createsky/lang',
  ]),
  'config.audit': python(
    'audit-changes.py',
    'pack',
    ['JSON configuration audit'],
    { args: ['--json'], successCodes: [0, 1], cancellable: true },
  ),
  'config.validate': python(
    'audit-changes.py',
    'validation',
    ['Validation result'],
    { args: ['--validate'], cancellable: true },
  ),
  'models.preview': python(
    'model-workbench.py',
    'pack',
    ['JSON models and textures'],
    {
      args: ['--stdin'],
      validate: documentInput,
      inputs: 'document: model recipe JSON, at most 1 MB',
      stdin: (input) => JSON.stringify(input.document),
      maxBytes: 8 * 1024 * 1024,
      cancellable: true,
    },
  ),
  'models.validate': python(
    'model-workbench.py',
    'pack',
    ['Validation result'],
    {
      args: ['--stdin', '--validate'],
      validate: documentInput,
      inputs: 'document: model recipe JSON, at most 1 MB',
      stdin: (input) => JSON.stringify(input.document),
      cancellable: true,
    },
  ),
  'resources.generate': python(
    'build-resource-patches.py',
    'pack',
    ['overrides/client/resourcepacks/Create Sky Resource Patches.zip'],
    { timeoutMs: 180000 },
  ),
  'objects.inputs': python(
    'build-resource-objects.py',
    'pack',
    ['.cache/resource-candidates'],
    { args: ['--materialize-inputs'], timeoutMs: 180000 },
  ),
  'objects.generate': python(
    'build-resource-objects.py',
    'pack',
    ['web/public/generated/objects'],
    { timeoutMs: 180000 },
  ),
  'objects.export': python(
    'export-models.py',
    'web',
    ['.cache/resource-exporter'],
    { timeoutMs: 60000 },
  ),
  'objects.preview': python(
    'build-resource-objects.py',
    'pack',
    ['JSON object preview', 'web/public/generated/objects/textures'],
    {
      args: ['--stdin'],
      validate: (input) => {
        if (
          !input ||
          Object.keys(input).sort().join() !== 'case,layers,object' ||
          typeof input.object !== 'string' ||
          input.object.length > 200 ||
          typeof input.case !== 'string' ||
          input.case.length > 160 ||
          !Array.isArray(input.layers) ||
          input.layers.length > 192 ||
          input.layers.some(
            (layer) => typeof layer !== 'string' || layer.length > 200,
          )
        )
          throw new Error(
            'Expected a registered object, case, and bounded layer list',
          )
      },
      inputs: 'object, case, layers: registered IDs only',
      stdin: (input) => JSON.stringify(input),
      maxBytes: 8 * 1024 * 1024,
      cancellable: true,
    },
  ),
  'textures.generate': python('build-texture-resources.py', 'pack', [
    'web/public/generated/texture-resources',
  ]),
  'snapshot.fingerprint': python(
    'fingerprint.py',
    'web',
    ['Source fingerprint'],
    { cancellable: true },
  ),
  'snapshot.capture': python('runtime.py', 'web', ['data/generated/runtime'], {
    timeoutMs: 660000,
  }),
  'snapshot.extract': python(
    'extract.py',
    'web',
    ['data/generated', 'public/generated/icons'],
    { timeoutMs: 660000 },
  ),
  'scenario.export': python('export_patch.py', 'web', [
    'public/generated/create-sky-atlas-patch.zip',
  ]),
})

export class JobError extends Error {
  constructor(message, code = 'failed') {
    super(message)
    this.code = code
  }
}

// One active process, one last result. No persisted job history or background queue.
export function createJobRunner(registry = jobRegistry) {
  let current = null,
    last = null
  const describe = (job) =>
    job && {
      id: job.id,
      name: job.name,
      state: job.state,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      cancellable: job.cancellable,
      diagnostic: job.diagnostic,
      error: job.error,
    }
  const snapshot = () => ({ current: describe(current), last: describe(last) })
  function run(name, context, input = {}) {
    const definition = Object.hasOwn(registry, name) && registry[name]
    if (!definition)
      return Promise.reject(new JobError('Unknown authoring job', 'invalid'))
    try {
      definition.validate(input)
    } catch (error) {
      return Promise.reject(error)
    }
    if (current)
      return Promise.reject(
        new JobError('Another authoring job is running', 'busy'),
      )
    const cwd = context[definition.cwd]
    if (typeof cwd !== 'string' || !path.isAbsolute(cwd))
      return Promise.reject(
        new JobError('Missing trusted job directory', 'invalid'),
      )
    const job = (current = {
      id: randomUUID(),
      name,
      state: 'running',
      startedAt: new Date().toISOString(),
      cancellable: definition.cancellable && process.platform !== 'win32',
      diagnostic: '',
    })
    return new Promise((resolve, reject) => {
      let child,
        timer,
        escalation,
        failure,
        bytes = 0,
        stdout = [],
        stderr = [],
        settled = false
      function signal(kind) {
        if (!child?.pid) return
        try {
          if (process.platform === 'win32') child.kill(kind)
          else process.kill(-child.pid, kind)
        } catch (error) {
          if (error.code !== 'ESRCH')
            job.diagnostic = String(error).slice(0, 16000)
        }
      }
      function stop(error) {
        if (failure || settled) return
        failure = error
        job.state = error.code === 'cancelled' ? 'cancelling' : 'stopping'
        signal('SIGTERM')
        escalation = setTimeout(() => signal('SIGKILL'), 500)
      }
      job.cancel = () =>
        stop(new JobError('Job cancelled; source was not applied', 'cancelled'))
      const finish = (error, code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        clearTimeout(escalation)
        if (failure) signal('SIGKILL')
        const out = Buffer.concat(stdout).toString('utf8'),
          err = Buffer.concat(stderr).toString('utf8')
        const reason =
          failure ||
          error ||
          (!(definition.successCodes || [0]).includes(code)
            ? new JobError(
                err.trim().slice(-16000) || `Job exited with code ${code}`,
              )
            : null)
        job.state = reason
          ? reason.code === 'cancelled'
            ? 'cancelled'
            : 'failed'
          : 'succeeded'
        job.finishedAt = new Date().toISOString()
        job.error = reason?.message
        job.cancellable = false
        last = job
        current = null
        if (reason) reject(reason)
        else resolve({ stdout: out, stderr: err, code })
      }
      try {
        child = spawn(
          definition.program,
          [path.join(cwd, 'scripts', definition.script), ...definition.args],
          {
            cwd,
            shell: false,
            detached: process.platform !== 'win32',
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        )
        timer = setTimeout(
          () =>
            stop(
              new JobError(
                `Job exceeded ${definition.timeoutMs / 1000}s limit`,
                'timeout',
              ),
            ),
          definition.timeoutMs,
        )
        const receive = (chunk, target, isError) => {
          if (failure) return
          bytes += chunk.length
          if (bytes > definition.maxBytes) {
            stop(new JobError('Job exceeded output limit', 'overflow'))
            return
          }
          target.push(chunk)
          // Preview stdout contains large JSON, not human diagnostics.
          if (isError)
            job.diagnostic = (job.diagnostic + chunk.toString('utf8')).slice(
              -16000,
            )
        }
        child.stdout.on('data', (chunk) => receive(chunk, stdout, false))
        child.stderr.on('data', (chunk) => receive(chunk, stderr, true))
        child.on('error', (error) => finish(error))
        child.on('close', (code) => finish(null, code))
        child.stdin.on('error', () => {})
        child.stdin.end(definition.stdin?.(input))
      } catch (error) {
        finish(error)
      }
    })
  }
  return {
    run,
    snapshot,
    cancel(id) {
      if (!current || current.id !== id || !current.cancellable)
        throw new JobError('This job cannot be cancelled', 'invalid')
      current.cancel()
      return snapshot()
    },
  }
}

export const jobs = createJobRunner()
