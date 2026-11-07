import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { domainFixture } from './domain-fixture.mjs'
import { createJobRunner, jobRegistry } from '../scripts/jobs.mjs'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'sky-models-')),
  )
  await fs.mkdir(path.join(root, 'authoring'))
  await fs.mkdir(path.join(root, 'scripts'))
  await fs.cp(path.resolve('../scripts'), path.join(root, 'scripts'), {
    recursive: true,
    filter: (file) => !file.includes('__pycache__'),
  })
  for (const name of ['empack.yml', 'empack.lock', 'empack.bindings.yml'])
    await fs.copyFile(path.resolve('..', name), path.join(root, name))
  await fs.mkdir(path.join(root, 'authoring/resource-licenses'))
  await fs.writeFile(
    path.join(root, 'authoring/resource-licenses/nautilus3d-AGPL-3.0.txt'),
    'Fixture license',
  )
  await fs.writeFile(
    path.join(root, 'authoring/model-recipes.json'),
    JSON.stringify({ schema: 1, recipes: [] }),
  )
  await fs.writeFile(
    path.join(root, 'authoring/visual-patches.json'),
    JSON.stringify({ schema: 1, sources: {} }),
  )
  await fs.writeFile(
    path.join(root, 'scripts/fixture-build.py'),
    "import json,sys,zipfile\nfrom pathlib import Path\np=Path(sys.argv[sys.argv.index('--output')+1])\nwith zipfile.ZipFile(p,'w') as z:\n z.writestr('pack.mcmeta',json.dumps({'pack':{'pack_format':34,'description':'fixture'}}))\n z.writestr('assets/fixture/test.txt','built')\n",
  )
  await fs.writeFile(
    path.join(root, 'authoring/resource-selections.json'),
    JSON.stringify({ schema: 1, selections: [] }),
  )
  await fs.writeFile(
    path.join(root, 'authoring/texture-resources.json'),
    JSON.stringify({ schema: 1, resources: [] }),
  )
  const runner = createJobRunner({
    ...jobRegistry,
    'resources.generate': {
      ...jobRegistry['resources.generate'],
      script: 'fixture-build.py',
    },
  })
  return { root, editor: domainFixture(t, root, 'models', runner) }
}

test('preview is read-only; save validates and generation is explicit', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  const document = { ...initial.document, description: 'Changed locally' }
  await editor.preview(document)
  assert.deepEqual((await editor.read()).document, initial.document)
  const saved = await editor.save({ document, revision: initial.revision })
  assert.deepEqual((await editor.read()).document, document)
  await assert.rejects(
    fs.stat(
      path.join(
        root,
        'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
      ),
    ),
    {
      code: 'ENOENT',
    },
  )
  await editor.generate({ revision: saved.revision })
  assert(
    (
      await fs.readFile(
        path.join(
          root,
          'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
        ),
      )
    )
      .subarray(0, 2)
      .equals(Buffer.from('PK')),
  )
})

test('invalid source and stale pins cannot overwrite or generate', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  await assert.rejects(
    editor.save({
      document: { schema: 99, recipes: [] },
      revision: initial.revision,
    }),
    /Unsupported/,
  )
  assert.deepEqual((await editor.read()).document, initial.document)
  await fs.appendFile(path.join(root, 'authoring/visual-patches.json'), '\n')
  await assert.rejects(
    editor.save({ document: initial.document, revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(
    editor.generate({ revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(
    fs.stat(
      path.join(
        root,
        'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
      ),
    ),
    {
      code: 'ENOENT',
    },
  )
})

test('source and temporary symlinks cannot redirect writes', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  const file = path.join(root, 'authoring/model-recipes.json'),
    outside = path.join(root, 'outside.json')
  await fs.writeFile(outside, 'original')
  await fs.symlink(outside, file + '.tmp')
  await editor.save({ document: initial.document, revision: initial.revision })
  assert.equal(await fs.readFile(outside, 'utf8'), 'original')
  await fs.unlink(file)
  await fs.symlink(outside, file)
  await assert.rejects(editor.read(), /symlinks/)
})

test('changed resource selections invalidate generation and preserve model edits', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  await fs.appendFile(
    path.join(root, 'authoring/resource-selections.json'),
    '\n',
  )
  await assert.rejects(
    editor.generate({ revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(
    editor.save({ document: initial.document, revision: initial.revision }),
    /changed/,
  )
  assert.deepEqual((await editor.read()).document, initial.document)
  await assert.rejects(
    fs.stat(
      path.join(
        root,
        'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
      ),
    ),
    {
      code: 'ENOENT',
    },
  )
})

test('changed texture approvals invalidate generation', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  await fs.appendFile(path.join(root, 'authoring/texture-resources.json'), '\n')
  await assert.rejects(
    editor.generate({ revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(
    fs.stat(
      path.join(
        root,
        'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip',
      ),
    ),
    {
      code: 'ENOENT',
    },
  )
})
