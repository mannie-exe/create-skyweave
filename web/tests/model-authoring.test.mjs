import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { modelAuthoring } from '../scripts/model-authoring.mjs'

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'sky-models-')),
  )
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'authoring'))
  await fs.mkdir(path.join(root, 'scripts'))
  for (const name of [
    'model-workbench.py',
    'model_authoring.py',
    'resource_inputs.py',
  ])
    await fs.copyFile(
      new URL('../../scripts/' + name, import.meta.url),
      path.join(root, 'scripts', name),
    )
  await fs.writeFile(
    path.join(root, 'authoring/model-recipes.json'),
    JSON.stringify({ schema: 1, recipes: [] }),
  )
  await fs.writeFile(
    path.join(root, 'authoring/resource-patches.json'),
    JSON.stringify({ schema: 1, sources: {} }),
  )
  await fs.writeFile(
    path.join(root, 'scripts/build-resource-patches.py'),
    "from pathlib import Path\nPath('generated.marker').write_text('built')\nprint('Generated')\n",
  )
  await fs.writeFile(
    path.join(root, 'authoring/resource-selections.json'),
    JSON.stringify({ schema: 1, selections: [] }),
  )
  await fs.writeFile(
    path.join(root, 'authoring/texture-resources.json'),
    JSON.stringify({ schema: 1, resources: [] }),
  )
  return { root, editor: modelAuthoring(root) }
}

test('preview is read-only; save validates and generation is explicit', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  const document = { ...initial.document, description: 'Changed locally' }
  await editor.preview(document)
  assert.deepEqual((await editor.read()).document, initial.document)
  const saved = await editor.save({ document, revision: initial.revision })
  assert.deepEqual((await editor.read()).document, document)
  await assert.rejects(fs.stat(path.join(root, 'generated.marker')), {
    code: 'ENOENT',
  })
  await editor.generate({ revision: saved.revision })
  assert.equal(
    await fs.readFile(path.join(root, 'generated.marker'), 'utf8'),
    'built',
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
  await fs.appendFile(path.join(root, 'authoring/resource-patches.json'), '\n')
  await assert.rejects(
    editor.save({ document: initial.document, revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(
    editor.generate({ revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(fs.stat(path.join(root, 'generated.marker')), {
    code: 'ENOENT',
  })
})

test('source and temporary symlinks cannot redirect writes', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  const file = path.join(root, 'authoring/model-recipes.json'),
    outside = path.join(root, 'outside.json')
  await fs.writeFile(outside, 'original')
  await fs.symlink(outside, file + '.tmp')
  await assert.rejects(
    editor.save({ document: initial.document, revision: initial.revision }),
    /EEXIST/,
  )
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
  await assert.rejects(fs.stat(path.join(root, 'generated.marker')), {
    code: 'ENOENT',
  })
})

test('changed texture approvals invalidate generation', async (t) => {
  const { root, editor } = await fixture(t)
  const initial = await editor.read()
  await fs.appendFile(path.join(root, 'authoring/texture-resources.json'), '\n')
  await assert.rejects(
    editor.generate({ revision: initial.revision }),
    /changed/,
  )
  await assert.rejects(fs.stat(path.join(root, 'generated.marker')), {
    code: 'ENOENT',
  })
})
