import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'

const read = (name) =>
  readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8')
const reviews = YAML.parse(read('authored/resourcepacks.yml')).candidates
const observations = JSON.parse(read('research/resourcepacks/projects.json'))
const localProjects = JSON.parse(
  read('research/resourcepacks/local-projects.json'),
)
const objectProjects = JSON.parse(
  read('research/resourcepacks/object-projects.json'),
).projects
const projects = {
  ...observations.projects,
  ...objectProjects,
  ...localProjects,
}
const catalog = JSON.parse(read('research/resourcepacks/catalog.json'))

test('resource reviews join to sourced galleries and hash-verified files', () => {
  assert.equal(new Set(reviews.map((r) => r.id)).size, reviews.length)
  assert.deepEqual(
    Object.keys(projects).sort(),
    reviews.map((r) => r.id).sort(),
  )
  for (const review of reviews) {
    for (const field of ['description', 'fit', 'concern', 'nextCheck'])
      assert.ok(review[field]?.trim(), `${review.id}: missing ${field}`)
    assert.ok(
      [
        'try',
        'installed',
        'compare',
        'partial',
        'conditional',
        'defer',
        'reject',
        'replaced',
      ].includes(review.status),
    )
    const project = projects[review.id]
    if (!(review.id in localProjects))
      assert.ok(project.gallery.length > 0 || project.fileNote, review.id)
    for (const image of project.gallery) {
      assert.ok(image.caption.trim(), review.id)
      for (const key of ['url', 'thumbnail', 'source'])
        assert.equal(new URL(image[key]).protocol, 'https:')
    }
    const file = project.inspection
    if (file) {
      assert.match(file.sha512, /^[a-f0-9]{128}$/)
      assert.equal(file.sha512, file.file.hashes.sha512)
      assert.ok(file.version.game_versions.includes('1.21.1'))
    } else assert.ok(project.fileNote || project.artifact)
  }
})

test('catalog ranks are contiguous per source and review links identify the same project', () => {
  for (const source of catalog.sources) {
    const rows = catalog.entries.filter((row) => row.source === source.id)
    assert.equal(rows.length, 250)
    assert.equal(new Set(rows.map((row) => row.url)).size, 250)
    assert.deepEqual(
      rows.map((row) => row.rank),
      Array.from({ length: 250 }, (_, i) => i + 1),
    )
  }
  const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const row of catalog.entries.filter((row) => row.candidate)) {
    assert.ok(projects[row.candidate], row.title)
    assert.ok(
      normalize(row.title).startsWith(normalize(projects[row.candidate].title)),
      row.title,
    )
  }
})

test('archived media has unique files, known projects and attributable runs', () => {
  const manifest = JSON.parse(read('research/resourcepacks/local-media.json'))
  const files = new Map(manifest.media.map((media) => [media.file, media]))
  assert.equal(
    new Set(manifest.media.map((media) => media.id)).size,
    manifest.media.length,
  )
  assert.equal(
    new Set(manifest.media.map((media) => media.file)).size,
    manifest.media.length,
  )
  for (const media of manifest.media) {
    assert.ok(manifest.runs[media.run], media.id)
    assert.match(manifest.runs[media.run].date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(media.projects.length)
    for (const project of media.projects) assert.ok(projects[project], project)
    assert.match(media.sha256, /^[a-f0-9]{64}$/)
    assert.ok(['image', 'video'].includes(media.kind))
    assert.match(media.source, /^(atlas|harness)\//)
    for (const relative of [media.file, media.source]) {
      assert.ok(!relative.includes('\\'))
      assert.ok(
        relative
          .split('/')
          .every((part) => part && part !== '.' && part !== '..'),
      )
    }
    assert.ok(media.caption.trim() && media.stage.trim())
    for (const original of media.originals || []) {
      assert.ok(original.label.trim(), media.id)
      assert.ok(files.has(original.file), `${media.id}: missing original`)
      assert.equal(files.get(original.file).kind, 'image')
      assert.equal(files.get(original.file).run, media.run)
      assert.ok(!files.get(original.file).originals?.length)
    }
  }
})
