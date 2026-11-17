import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import {
  resourceStack,
  selectionStatus,
} from '../src/lib/resourcepack-stack.mjs'
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const manifest = YAML.parse(read('../../empack.yml'))
const lock = YAML.parse(read('../../empack.lock'))
const options = read('../../overrides/client/options.txt')
const { projects } = JSON.parse(
  read('../data/research/resourcepacks/projects.json'),
)

test('current defaults retain optional Fresh mobs and selected object and held-item resources', () => {
  const { stack } = resourceStack(manifest, lock, options, projects)
  assert.deepEqual(
    Object.keys(stack).sort(),
    Object.entries(manifest.dependencies)
      .filter(([, dependency]) => dependency.type === 'resource-pack')
      .map(([id]) => id)
      .sort(),
  )
  assert.deepEqual(
    Object.entries(stack)
      .filter(([, item]) => !item.enabled)
      .map(([id]) => id)
      .sort(),
    ['fresh-animations', 'fresh-animations-details'],
  )
  for (const id of [
    'fresh-animations-objects',
    'refined-tools',
    'refined-torches',
    'refined-buckets',
    'refined-create-buckets',
    'luminous-lanterns',
    'punched-backpacks',
  ])
    assert.ok(stack[id]?.enabled, id)
  for (const [id, item] of Object.entries(stack)) {
    assert.ok(item.intentMatches, id)
    if (item.enabled) assert.ok(item.order >= 0, id)
    else assert.equal(item.order, -1, id)
  }
})

test('archived inspection is independent of default selection and missing evidence', () => {
  const dependencies = Object.fromEntries(
    ['disabled', 'changed', 'unreviewed', 'unresolved'].map((id) => [
      id,
      { type: 'resource-pack', pin: 'v1' },
    ]),
  )
  const files = (id) => [
    {
      placements: [{ destination: `resourcepacks/${id}.zip` }],
      expected: { digests: { sha512: id } },
    },
  ]
  const locked = Object.fromEntries(
    ['disabled', 'changed', 'unreviewed'].map((id) => [
      id,
      { selection: { selection: { id: 'v1' } }, files: files(id) },
    ]),
  )
  const { stack } = resourceStack(
    { dependencies },
    { dependencies: locked },
    'resourcePacks:["file/changed.zip","file/unreviewed.zip"]',
    {
      disabled: { inspection: { sha512: 'disabled' } },
      changed: { inspection: { sha512: 'old-file' } },
    },
  )
  assert.equal(stack.disabled.enabled, false)
  assert.equal(stack.disabled.inspectionMatches, true)
  assert.equal(stack.changed.enabled, true)
  assert.equal(stack.changed.inspectionMatches, false)
  assert.equal(stack.unreviewed.intentMatches, true)
  assert.equal(stack.unreviewed.inspectionMatches, false)
  assert.equal(stack.unresolved.enabled, false)
  assert.equal(stack.unresolved.intentMatches, false)
  assert.equal(stack.unresolved.inspectionMatches, false)
})

test('selection distinguishes disabled files, missing artifacts and shared resource mods', () => {
  const { stack } = resourceStack(
    manifest,
    lock,
    'resourcePacks:["vanilla"]',
    projects,
    {
      patch: {
        present: true,
        filename: 'patch.zip',
        kind: 'Resource pack',
        side: 'Client',
      },
      fixes: {
        present: true,
        filename: 'fixes.jar',
        kind: 'Resource-only mod',
        side: 'Client and server',
      },
      missing: {
        present: false,
        filename: 'gone.zip',
        kind: 'Resource pack',
        side: 'Client',
      },
    },
  )
  assert.equal(
    selectionStatus({ id: 'fresh-animations', status: 'installed' }, stack),
    'available',
  )
  assert.equal(
    selectionStatus({ id: 'patch', status: 'installed' }, stack),
    'available',
  )
  assert.equal(
    selectionStatus({ id: 'fixes', status: 'installed' }, stack),
    'installed',
  )
  assert.equal(
    selectionStatus({ id: 'missing', status: 'installed' }, stack),
    'unselected',
  )
  assert.equal(
    selectionStatus({ id: 'removed', status: 'installed' }, stack),
    'unselected',
  )
  assert.equal(
    selectionStatus({ id: 'candidate', status: 'compare' }, stack),
    'compare',
  )
  assert.equal(stack.fixes.order, -1)
  const changed = structuredClone(lock)
  changed.dependencies['fresh-animations'].files[0].expected.digests.sha512 =
    'changed'
  assert.equal(
    resourceStack(manifest, changed, options, projects).stack[
      'fresh-animations'
    ].inspectionMatches,
    false,
  )
})
