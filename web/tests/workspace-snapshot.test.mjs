import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import {
  createWorkspaceService,
  defineOperation,
} from '../scripts/workspace/service.ts'
import { createArtifactStore } from '../scripts/workspace/artifacts.ts'
import { createNativeExecutor } from '../scripts/workspace/native.ts'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'
import { createEnvironmentResolver } from '../scripts/workspace/environment.ts'
import { snapshotDefinitions } from '../scripts/workspace/snapshot.ts'
import { compileInputs } from '../scripts/compile.mjs'
import { domains } from '../src/lib/domains.mjs'
import { z } from 'zod'

test(
  'refresh stages capture/extraction/compile, preserves surveys, and never replaces good evidence after failure or conflict',
  { timeout: 30000 },
  async (t) => {
    const root = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-snapshot-')),
    )
    const registration = {
      scope: { workspaceId: 'local', packId: 'fixture' },
      web: root,
      pack: root,
    }
    const actor = {
      principal: { kind: 'anonymous', id: 'local-open' },
      connectionId: randomUUID(),
    }
    for (const folder of [
      'authoring',
      'data/authored',
      'data/generated/runtime',
      'src/lib',
      'profiles',
      'tools/exporter',
      'installation/libraries',
      'overrides/common/config',
    ])
      await fs.mkdir(path.join(root, folder), { recursive: true })
    await fs.cp(path.resolve('../scripts'), path.join(root, 'scripts'), {
      recursive: true,
      filter: (file) => !file.includes('__pycache__'),
    })
    for (const name of [
      'paths.py',
      'runtime.py',
      'runtime_capture.py',
      'fingerprint.py',
      'extract.py',
      'item_icons.py',
      'feature_switches.py',
      'runtime-inputs.mjs',
      'resource-inputs.mjs',
      'compile.mjs',
      'configuration.mjs',
    ])
      await fs.copyFile('scripts/' + name, path.join(root, 'scripts', name))
    for (const file of (await fs.readdir('src/lib')).filter((name) =>
      name.endsWith('.mjs'),
    ))
      await fs.copyFile('src/lib/' + file, path.join(root, 'src/lib', file))
    await fs.copyFile(
      'profiles/minecraft-1.21.1-neoforge.json',
      path.join(root, 'profiles/minecraft-1.21.1-neoforge.json'),
    )
    async function write(file, value) {
      await fs.writeFile(
        path.join(root, file),
        typeof value === 'string' ? value : JSON.stringify(value),
      )
    }
    await write('data/local.example.json', {
      pack: '.',
      server: 'installation',
      vanilla: 'vanilla.jar',
    })
    await write('vanilla.jar', 'fixture vanilla bytes')
    await write('authoring/visual-patches.json', {
      schema: 1,
      sources: {
        minecraft: {
          sha512: createHash('sha512')
            .update('fixture vanilla bytes')
            .digest('hex'),
        },
      },
    })
    await write('empack.yml', {
      runtime: {
        minecraft: '1.21.1',
        loader: { kind: 'neoforge', pin: '21.1.264' },
      },
    })
    await write('empack.lock', {
      runtime: {
        minecraft: '1.21.1',
        loader: 'neoforge',
        'loader-version': '21.1.264',
      },
      dependencies: {},
    })
    await write('empack.bindings.yml', 'schema: 1\n')
    await write('pnpm-lock.yaml', 'fixture lock')
    await write('installation/eula.txt', 'eula=true\n')
    await write('overrides/common/config/fixture.json', { selected: true })
    await write('data/generated/world.json', {
      survey: 'preserve this evidence',
    })
    await write('data/generated/marker.json', { previous: true })
    await write('data/generated/runtime/snapshot.json', {
      sourceFingerprint: '0'.repeat(64),
    })
    for (const name of domains)
      await write(
        'data/authored/' + name + '.yml',
        name === 'recipes' ? 'schema: 1\nchanges: []\n' : 'schema: 1\n',
      )
    const runtimeNames = compileInputs
      .filter((name) => name.startsWith('runtime/'))
      .map((name) => name.slice('runtime/'.length))
    // Producers are bounded fixtures. Real service admission, revision guards,
    // generated-input transaction and immutable artifact publication are under test.
    await write(
      'scripts/fixture-capture.py',
      `import hashlib,json,sys\nfrom pathlib import Path\nfrom fingerprint import fingerprint\na=sys.argv\nout=Path(a[a.index('--output')+1])\nassert Path(a[a.index('--work')+1]).is_dir()\nmode=Path('fixture-mode').read_text() if Path('fixture-mode').exists() else 'good'\nif mode=='capture-fail': raise RuntimeError('Fixture capture failed')\nfor name in ${JSON.stringify(runtimeNames)}: (out/(name+'.json')).write_text('[]')\n(out/'complete.json').write_text(json.dumps({'minecraft':'1.21.1'}))\n(out/'snapshot.json').write_text(json.dumps({'sourceFingerprint':fingerprint('pack'),'sourceChangedDuringExport':False,'lockSha256':hashlib.sha256(Path('empack.lock').read_bytes()).hexdigest()}))\n(out/'errors.json').write_text('[]' if mode!='errors' else '["fixture error"]')\n`,
    )
    await write(
      'scripts/fixture-extract.py',
      `import json,sys\nfrom pathlib import Path\na=sys.argv\nout=Path(a[a.index('--output')+1])\nassert (Path(a[a.index('--runtime')+1])/'complete.json').is_file()\nassert Path(a[a.index('--icons')+1]).is_dir()\nmode=Path('fixture-mode').read_text() if Path('fixture-mode').exists() else 'good'\nfor name in ['catalog','documents','configs','mods','diagnostics','translations']: (out/(name+'.json')).write_text('[]')\nif mode=='invalid': (out/'configs.json').write_text('broken JSON')\n`,
    )
    await write(
      'scripts/fixture-compile.mjs',
      `import fs from 'node:fs/promises';import path from 'node:path';const a=process.argv.slice(2),out=a[a.indexOf('--output')+1],data=a[a.indexOf('--data')+1];if(!data)throw Error('No staged dataset');JSON.parse(await fs.readFile(path.join(data,'runtime/complete.json'),'utf8'));for(const name of ['catalog','domains','routes','authored'])await fs.writeFile(path.join(out,name+'.json'),JSON.stringify({fresh:true}));`,
    )
    let service,
      denied = false,
      starts = 0
    const runner = createJobRunner({
      ...jobRegistry,
      'snapshot.capture': {
        ...jobRegistry['snapshot.capture'],
        script: 'fixture-capture.py',
      },
      'snapshot.extract': {
        ...jobRegistry['snapshot.extract'],
        script: 'fixture-extract.py',
      },
      'map.compile': {
        ...jobRegistry['map.compile'],
        script: 'fixture-compile.mjs',
      },
    })
    runner.subscribe((snapshot) => {
      if (snapshot.current?.state === 'running' && !snapshot.current.diagnostic)
        starts++
    })
    const native = createNativeExecutor({
      runner,
      session: () => service.session,
    })
    const artifacts = createArtifactStore({
      root: path.join(root, '.cache/artifacts'),
      registrations: [registration],
      can: (ctx, grant) => service.can(ctx, grant),
    })
    const environment = createEnvironmentResolver([registration])
    service = createWorkspaceService({
      registrations: [registration],
      definitions: [
        ...snapshotDefinitions([registration], native, artifacts, environment),
        defineOperation({
          name: 'fixture.read',
          effect: 'query',
          input: z.strictObject({}),
          output: z.unknown(),
          label: 'Read',
          href: '/',
          success: '',
          targets: () => [],
          execute: async () =>
            JSON.parse(
              await fs.readFile(
                path.join(root, 'data/generated/marker.json'),
                'utf8',
              ),
            ),
        }),
      ],
      policy: {
        mode: 'restricted',
        decide: (_ctx, action, target) => ({
          allowed:
            !denied ||
            action !== 'source.read' ||
            target.id !== 'config:authored:common/config/fixture.json',
        }),
      },
      shutdown: () => native.dispose(),
    })
    t.after(async () => {
      await service.dispose()
      await fs.rm(root, { recursive: true, force: true })
    })
    const submit = (operation, payload = {}) =>
      service.submit(actor, {
        v: 1,
        type: 'command',
        requestId: randomUUID(),
        commandId: randomUUID(),
        session: service.session,
        createdAt: new Date().toISOString(),
        scope: registration.scope,
        operation,
        payload,
      })
    const command = async (name, payload) =>
      (await submit(name, payload)).outcome
    assert.equal((await command('snapshot.check')).payload.stale, true)
    const before = await fs.readFile(
      path.join(root, 'data/generated/runtime/snapshot.json'),
      'utf8',
    )
    const ready = Promise.withResolvers()
    const off = runner.subscribe((snapshot) => {
      if (snapshot.current?.name === 'snapshot.capture') ready.resolve()
    })
    const running = await submit('snapshot.refresh')
    await Promise.race([
      ready.promise,
      running.outcome.then((outcome) => {
        throw new Error(
          outcome.error?.message ?? 'Capture ended before inspection',
        )
      }),
    ])
    assert.deepEqual(
      await service.query(actor, registration.scope, 'fixture.read', {}),
      { previous: true },
    )
    const first = await running.outcome
    off()
    assert.equal(first.operation.state, 'succeeded', first.error?.message)
    assert.equal((await command('snapshot.check')).payload.stale, false)
    assert.notEqual(
      await fs.readFile(
        path.join(root, 'data/generated/runtime/snapshot.json'),
        'utf8',
      ),
      before,
    )
    assert.deepEqual(
      JSON.parse(
        await fs.readFile(path.join(root, 'data/generated/world.json'), 'utf8'),
      ),
      { survey: 'preserve this evidence' },
    )
    const current = await artifacts.active(actor, registration.scope, 'map')
    assert.equal(current.id, first.payload.generationId)
    assert.ok(
      first.operation.stages.some((stage) => stage.name === 'snapshot-inputs'),
    )
    const preserved = await fs.readFile(
      path.join(root, 'data/generated/runtime/snapshot.json'),
      'utf8',
    )
    for (const mode of ['capture-fail', 'errors', 'invalid']) {
      await write('fixture-mode', mode)
      const failed = await command('snapshot.refresh')
      assert.equal(failed.operation.state, 'failed', mode)
      assert.equal(
        (await artifacts.active(actor, registration.scope, 'map')).id,
        current.id,
      )
      assert.equal(
        await fs.readFile(
          path.join(root, 'data/generated/runtime/snapshot.json'),
          'utf8',
        ),
        preserved,
      )
    }
    await write('fixture-mode', 'good')
    let changed = false
    const changing = runner.subscribe((snapshot) => {
      if (!changed && snapshot.current?.name === 'snapshot.extract') {
        changed = true
        appendFileSync(path.join(root, 'data/authored/progression.yml'), '\n')
      }
    })
    assert.equal(
      (await command('snapshot.refresh')).error.code,
      'REVISION_CONFLICT',
    )
    changing()
    assert.equal(
      (await artifacts.active(actor, registration.scope, 'map')).id,
      current.id,
    )
    assert.equal(
      await fs.readFile(
        path.join(root, 'data/generated/runtime/snapshot.json'),
        'utf8',
      ),
      preserved,
    )
    const count = starts
    await assert.rejects(
      command('snapshot.refresh', { path: '/tmp/unregistered' }),
      { code: 'INVALID_INPUT' },
    )
    denied = true
    await assert.rejects(command('snapshot.refresh'), { code: 'NOT_FOUND' })
    assert.equal(starts, count)
    assert.deepEqual(
      await fs.readdir(path.join(root, '.cache/workspace/staging')),
      [],
    )
    assert.deepEqual(
      await fs.readdir(
        path.join(root, '.cache/workspace/local/fixture/processes'),
      ),
      [],
    )
  },
)
