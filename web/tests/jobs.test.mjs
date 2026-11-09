import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'

async function fixture(t, source, options = {}) {
  const dir = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'sky-jobs-')),
  )
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  await fs.mkdir(path.join(dir, 'scripts'))
  await fs.writeFile(path.join(dir, 'scripts/generate-quests.py'), source)
  const runner = createJobRunner({
    job: { ...jobRegistry['quests.preview'], timeoutMs: 3000, ...options },
  })
  return { runner, context: { pack: dir }, dir }
}

test('named jobs reject arbitrary names and arguments before execution', async (t) => {
  const { runner, context } = await fixture(t, "print('ok')")
  for (const name of ['__proto__', 'python3', 'quests.preview; rm -rf /'])
    await assert.rejects(runner.run(name, context), /Unknown/)
  for (const input of [{ args: ['--evil'] }, null, [], { program: 'sh' }])
    await assert.rejects(runner.run('job', context, input), /no inputs/)
  const result = await runner.run('job', context)
  assert.equal(result.stdout.trim(), 'ok')
  assert.equal(runner.snapshot().last.state, 'succeeded')
})

test('failure retains bounded plain diagnostics and permits the next job', async (t) => {
  const { runner, context } = await fixture(
    t,
    "import sys\nprint('<img src=x onerror=alert(1)>',file=sys.stderr)\nsys.exit(2)",
  )
  await assert.rejects(runner.run('job', context), /<img/)
  assert.equal(runner.snapshot().last.state, 'failed')
  assert.equal(runner.snapshot().current, null)
  await assert.rejects(runner.run('job', context), /<img/)
})

test('excessive output is stopped without retaining the oversized chunk', async (t) => {
  const { runner, context } = await fixture(
    t,
    "import sys\nwhile True: sys.stdout.write('x'*8192);sys.stdout.flush()",
    { maxBytes: 1024 },
  )
  await assert.rejects(runner.run('job', context), (e) => e.code === 'overflow')
  assert.ok(runner.snapshot().last.diagnostic.length <= 16000)
  assert.equal(runner.snapshot().current, null)
})

test('timeout escalates when the process ignores TERM', async (t) => {
  const { runner, context } = await fixture(
    t,
    'import signal,time\nsignal.signal(signal.SIGTERM,signal.SIG_IGN)\ntime.sleep(30)',
    { timeoutMs: 150 },
  )
  const started = Date.now()
  await assert.rejects(runner.run('job', context), (e) => e.code === 'timeout')
  assert.ok(Date.now() - started < 2500)
})

test('overlap is rejected and cancellation targets the exact running job', async (t) => {
  const { runner, context } = await fixture(t, 'import time\ntime.sleep(30)')
  const first = runner.run('job', context)
  const rejected = assert.rejects(first, (e) => e.code === 'cancelled')
  await assert.rejects(runner.run('job', context), (e) => e.code === 'busy')
  assert.throws(() => runner.cancel('wrong'), /cannot be cancelled/)
  runner.cancel(runner.snapshot().current.id)
  await rejected
  assert.equal(runner.snapshot().last.state, 'cancelled')
})

test('publishing jobs do not expose cancellation', async (t) => {
  const { runner, context } = await fixture(t, "print('done')", {
    cancellable: false,
  })
  const result = runner.run('job', context)
  assert.throws(
    () => runner.cancel(runner.snapshot().current.id),
    /cannot be cancelled/,
  )
  await result
})

test('real journal generation uses the registered command in an isolated source copy', async (t) => {
  const { dir } = await fixture(t, '')
  const pack = path.resolve('..')
  await fs.cp(path.join(pack, 'authoring'), path.join(dir, 'authoring'), {
    recursive: true,
  })
  await fs.copyFile(
    path.join(pack, 'scripts/generate-quests.py'),
    path.join(dir, 'scripts/generate-quests.py'),
  )
  await fs.copyFile(
    path.join(pack, 'scripts/quests.py'),
    path.join(dir, 'scripts/quests.py'),
  )
  const runner = createJobRunner()
  const preview = JSON.parse(
    (await runner.run('quests.preview', { pack: dir })).stdout,
  )
  assert.equal(preview.outputs, 14)
  await runner.run('quests.generate', { pack: dir })
  assert.equal(
    JSON.parse((await runner.run('quests.preview', { pack: dir })).stdout)
      .changed.length,
    0,
  )
})

test('cancellation terminates subprocess descendants before releasing the runner', async (t) => {
  if (process.platform === 'win32')
    return t.skip('Process-group cancellation is POSIX only')
  const { runner, context, dir } = await fixture(
    t,
    `import subprocess,time
from pathlib import Path
child=subprocess.Popen(['python3','-c',"import time;time.sleep(30)"])
Path('child.pid').write_text(str(child.pid))
time.sleep(30)
`,
  )
  const running = runner.run('job', context)
  const failure = assert.rejects(running, (e) => e.code === 'cancelled')
  let pid
  for (let i = 0; i < 100; i++) {
    try {
      const value = Number(
        await fs.readFile(path.join(dir, 'child.pid'), 'utf8'),
      )
      if (Number.isSafeInteger(value) && value > 0) {
        pid = value
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(pid)
  runner.cancel(runner.snapshot().current.id)
  await failure
  // Reaping is asynchronous after the whole process group is terminated.
  let stopped = false
  for (let i = 0; i < 100; i++) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if (error.code === 'ESRCH') {
        stopped = true
        break
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(stopped, true)
  assert.equal(runner.snapshot().current, null)
})

test('nested named tools use the host-resolved search path without shell execution', async (t) => {
  const { runner, context, dir } = await fixture(
    t,
    "import subprocess\nprint(subprocess.check_output(['node','--version'],text=True).strip())",
  )
  const bin = path.join(dir, 'bin')
  await fs.mkdir(bin)
  const node = path.join(bin, 'node')
  await fs.writeFile(node, '#!/bin/sh\nprintf "%s\\n" "fixture-node"\n', {
    mode: 0o755,
  })
  const result = await runner.run('job', { ...context, tools: { node } })
  assert.equal(result.stdout.trim(), 'fixture-node')
})
