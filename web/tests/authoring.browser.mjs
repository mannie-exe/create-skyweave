import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mockWorkspace } from './workspace-fixture.mjs'
import { createHash } from 'node:crypto'
const source = fileURLToPath(new URL('../../authoring', import.meta.url))
async function fixture(page, live = false) {
  const files = {}
  for (const dir of ['quests', 'quests/chapters', 'quests/locales', 'changes'])
    for (const name of await fs.readdir(path.join(source, dir))) {
      if (!name.endsWith('.json')) continue
      files[dir + '/' + name] = {
        text: await fs.readFile(path.join(source, dir, name), 'utf8'),
        revision: 'initial',
      }
    }
  const state = {
    files,
    saves: 0,
    generated: 0,
    previews: 0,
    fail: false,
    failRead: false,
    last: null,
  }
  const inventory = () => ({
    entries: Object.entries(files).map(([id, file]) => ({
      id,
      revision: createHash('sha256').update(file.text).digest('hex'),
    })),
    revision: String(state.saves).padStart(64, '0'),
    monitoring: 'ready',
    restartRequired: false,
  })
  state.wire = await mockWorkspace(
    page,
    async (frame, { artifact }) => {
      const operation = frame.operation
      if (operation === 'sources.inventory') return inventory()
      if (['quests.save', 'config.source.save'].includes(operation)) {
        if (state.fail)
          throw Object.assign(
            new Error('File changed on disk. Reload before saving.'),
            { code: 'REVISION_CONFLICT' },
          )
        const input = frame.payload
        expect(input.revision).toBe('snapshot-' + state.saves)
        state.last = input
        state.saves++
        for (const [name, text] of Object.entries(input.changes)) {
          if (text === null) delete files[name]
          else files[name] = { text, revision: 'saved-' + state.saves }
        }
        return { revision: 'snapshot-' + state.saves }
      }
      if (operation === 'quests.generate') {
        state.generated++
        return { output: 'Generated' }
      }
      if (operation === 'quests.preview') {
        state.previews++
        return artifact({
          changed: state.generated
            ? []
            : [
                'overrides/common/config/ftbquests/quests/chapters/workshop.snbt',
              ],
          removed: [],
          outputs: 14,
        })
      }
      if (state.failRead && state.saves) {
        state.failRead = false
        throw new Error('Read temporarily unavailable')
      }
      return {
        files,
        revision: 'snapshot-' + state.saves,
        preview: { state: 'unavailable' },
      }
    },
    [
      'quests.read',
      'quests.preview',
      'quests.save',
      'config.source.save',
      'quests.generate',
      ...(live ? ['sources.inventory'] : []),
    ],
    { snapshot: () => inventory() },
  )
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  return state
}
const button = (page, name) => page.getByRole('button', { name, exact: true })
const en = (state) => JSON.parse(state.files['quests/locales/en_us.json'].text)

const quest = (state, key) =>
  Object.entries(state.files)
    .filter(([name]) => name.startsWith('quests/chapters/'))
    .flatMap(([name, file]) =>
      JSON.parse(file.text).quests.map((row) => ({ ...row, source: name })),
    )
    .find((row) => row.key === key)

test('external quest changes refresh clean text, preserve drafts and never start preview jobs', async ({
  page,
}) => {
  const state = await fixture(page, true),
    id = quest(state, 'glider').id
  await button(page, 'Localization').click()
  await page
    .getByLabel('Find key or text', { exact: true })
    .fill(`objects.${id}.title`)
  const field = page.getByLabel(`Source objects.${id}.title`, { exact: true }),
    previews = state.previews
  function change(title) {
    const document = en(state)
    document.objects[id].title = title
    state.files['quests/locales/en_us.json'].text = JSON.stringify(document)
    state.saves++
    state.wire.emit('sources', {
      sources: ['quests/locales/en_us.json'],
      revisions: { 'quests/locales/en_us.json': String(state.saves) },
    })
  }
  change('External glider')
  await expect(field).toHaveValue('External glider')
  expect(state.previews).toBe(previews)
  await field.fill('My draft')
  change('Another edit')
  await expect(field).toHaveValue('My draft')
  await expect(
    page.getByRole('status').filter({ hasText: 'Your draft is preserved' }),
  ).toBeVisible()
  await expect(button(page, 'Save quests')).toBeDisabled()
})

test('acknowledged saves remain saved when the follow-up read fails', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.getByLabel('Title · en_us', { exact: true }).fill('Saved title')
  state.failRead = true
  await button(page, 'Save quests').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'View refresh failed' }),
  ).toBeVisible()
  expect(state.saves).toBe(1)
  await expect(page.getByLabel('Title · en_us', { exact: true })).toHaveValue(
    'Saved title',
  )
  await expect(button(page, 'Save quests')).toBeDisabled()
})

test('quest CRUD coordinates native mechanics, rewards and stable layout IDs', async ({
  page,
}) => {
  const state = await fixture(page)
  await button(page, 'New quest').click()
  await page.getByLabel('Source key', { exact: true }).fill('review_route')
  await page.getByLabel('English title', { exact: true }).fill('Review route')
  await page
    .getByLabel('First task item ID', { exact: true })
    .fill('minecraft:iron_ingot')
  await button(page, 'Create quest').click()
  await button(page, 'Tasks').click()
  await page.getByLabel('Count', { exact: true }).fill('4')
  await button(page, 'Rewards').click()
  await button(page, 'Add reward').click()
  await page.getByLabel('Claim scope', { exact: true }).selectOption('team')
  await button(page, 'Links').click()
  await page.getByLabel('X', { exact: true }).fill('3.25')
  await page.getByLabel('Y', { exact: true }).fill('-2.5')
  await button(page, 'Save quests').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Source saved.' }),
  ).toBeVisible()
  let row = quest(state, 'review_route')
  const id = row.id,
    taskId = row.tasks[0].id
  expect(row.tasks[0].count).toBe(4)
  expect(row.rewards[0].native.team_reward).toBe(true)
  expect([row.x, row.y]).toEqual([3.25, -2.5])
  await page
    .getByLabel('Chapter membership', { exact: true })
    .selectOption('crossings')
  await button(page, 'Save quests').click()
  await expect
    .poll(() => quest(state, 'review_route').source)
    .toBe('quests/chapters/crossings.json')
  row = quest(state, 'review_route')
  expect(row.id).toBe(id)
  expect(row.tasks[0].id).toBe(taskId)
  page.once('dialog', (dialog) => dialog.accept())
  await button(page, 'Delete quest').click()
  await button(page, 'Save quests').click()
  await expect.poll(() => quest(state, 'review_route')).toBeUndefined()
  expect(en(state).objects[id]).toBeUndefined()
})

test('chapter creation and deletion produce coordinated source changes', async ({
  page,
}) => {
  const state = await fixture(page)
  await button(page, 'New chapter').click()
  await page.getByLabel('Source key', { exact: true }).fill('review')
  await page.getByLabel('English title', { exact: true }).fill('Review chapter')
  await button(page, 'Create chapter').click()
  await expect(
    page.getByRole('region', { name: 'Chapter settings', exact: true }),
  ).toBeVisible()
  await button(page, 'Save quests').click()
  await expect
    .poll(() => state.files['quests/chapters/review.json'])
    .toBeTruthy()
  const chapter = JSON.parse(state.files['quests/chapters/review.json'].text)
  expect(en(state).objects[chapter.id].title).toBe('Review chapter')
  page.once('dialog', (dialog) => dialog.accept())
  await button(page, 'Delete empty chapter').click()
  await button(page, 'Save quests').click()
  await expect
    .poll(() => state.files['quests/chapters/review.json'])
    .toBeUndefined()
})

test('localized titles retain sparse English fallback', async ({ page }) => {
  const state = await fixture(page),
    id = quest(state, 'glider').id
  await button(page, 'Localization').click()
  await page.getByText('Manage locales', { exact: true }).click()
  await page.getByLabel('Language to add').selectOption('de_de')
  await button(page, 'Add locale').click()
  await page.getByLabel('Find key or text').fill(`objects.${id}.title`)
  await expect(
    page.getByText('English fallback', { exact: true }),
  ).toBeVisible()
  await page
    .getByLabel(`Translation objects.${id}.title`, { exact: true })
    .fill('Gleiter')
  await button(page, 'Save quests').click()
  await expect
    .poll(
      () =>
        JSON.parse(state.files['quests/locales/de_de.json'].text).objects[id]
          ?.title,
    )
    .toBe('Gleiter')
  await button(page, 'Use English').click()
  await expect(
    page.getByText('English fallback', { exact: true }),
  ).toBeVisible()
  await button(page, 'Save quests').click()
  await expect
    .poll(
      () =>
        JSON.parse(state.files['quests/locales/de_de.json'].text).objects[id]
          ?.title,
    )
    .toBeUndefined()
})

test('invalid numeric and JSON drafts survive navigation and block saving', async ({
  page,
}) => {
  await fixture(page)
  await button(page, 'Links').click()
  await page.getByLabel('X', { exact: true }).fill('')
  await expect(button(page, 'Save quests')).toBeDisabled()
  await button(page, 'Text').click()
  await button(page, 'Links').click()
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('')
  await page.getByLabel('X', { exact: true }).fill('1.25')
  await expect(button(page, 'Save quests')).toBeEnabled()
  await page
    .getByText('Quest source and native properties', { exact: true })
    .click()
  await page.getByLabel('Quest JSON', { exact: true }).fill('{')
  await button(page, 'Apply quest json').click()
  await expect(button(page, 'Save quests')).toBeDisabled()
  await button(page, 'Localization').click()
  await page
    .getByRole('navigation', { name: 'Quest tools' })
    .getByRole('button', { name: 'Quests', exact: true })
    .click()
  await expect(page.getByLabel('Quest JSON', { exact: true })).toHaveValue('{')
})

test('failed saves preserve edits and generation is distinct from saving', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.getByLabel('Title · en_us', { exact: true }).fill('Retained draft')
  state.fail = true
  await button(page, 'Save quests').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'File changed on disk' }),
  ).toBeVisible()
  await expect(page.getByLabel('Title · en_us', { exact: true })).toHaveValue(
    'Retained draft',
  )
  expect(state.generated).toBe(0)
  state.fail = false
  await button(page, 'Save quests').click()
  await expect(button(page, 'Generate FTB Quests files')).toBeEnabled()
  await button(page, 'Generate FTB Quests files').click()
  await expect.poll(() => state.generated).toBe(1)
})

test('canvas selection, keyboard coordinate edits and responsive panels remain usable', async ({
  page,
}) => {
  const state = await fixture(page),
    glider = quest(state, 'glider')
  await page.getByLabel('Chapter', { exact: true }).selectOption('crossings')
  const node = page.locator(`.react-flow__node[data-id="${glider.id}"]`)
  await node.click()
  await expect(page.getByLabel('Title · en_us', { exact: true })).toHaveValue(
    en(state).objects[glider.id].title,
  )
  const before = await node.boundingBox()
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    before.x + before.width / 2 + 32,
    before.y + before.height / 2 + 24,
    { steps: 8 },
  )
  await page.mouse.up()
  await button(page, 'Save quests').click()
  await expect.poll(() => quest(state, 'glider').x).not.toBe(glider.x)
  for (const width of [1720, 1000, 390]) {
    await page.setViewportSize({ width, height: 950 })
    await expect(
      page.getByLabel('Title · en_us', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
})

test('shared paragraph references survive edits and invalid native ID edits stay unapplied', async ({
  page,
}) => {
  const state = await fixture(page)
  const chapter = JSON.parse(state.files['quests/chapters/workshop.json'].text),
    id = chapter.quests[0].id
  await button(page, 'Shared text').click()
  await button(page, 'New shared text').click()
  await page.getByLabel('Key', { exact: true }).fill('review_message')
  await page
    .getByLabel('English message', { exact: true })
    .fill('A reusable explanation.')
  await button(page, 'Create shared text').click()
  await page
    .getByRole('navigation', { name: 'Quest tools' })
    .getByRole('button', { name: 'Quests', exact: true })
    .click()
  await page.getByLabel('Paragraph 1', { exact: true }).selectOption('shared')
  await page
    .getByLabel('Shared text key', { exact: true })
    .selectOption('review_message')
  await button(page, 'Save quests').click()
  await expect
    .poll(() => en(state).objects[id].quest_desc[0])
    .toEqual({ shared: 'review_message' })
  await button(page, 'Shared text').click()
  await expect(button(page, 'Delete shared text')).toBeDisabled()
  await button(page, en(state).objects[id].title).click()
  await page
    .getByText('Quest source and native properties', { exact: true })
    .click()
  const raw = page.getByLabel('Quest JSON', { exact: true }),
    source = JSON.parse(await raw.inputValue())
  source.id = '0000000000000001'
  await raw.fill(JSON.stringify(source))
  await button(page, 'Apply quest json').click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'native ID stable' }),
  ).toBeVisible()
  await expect(raw).toHaveValue(JSON.stringify(source))
  await expect(button(page, 'Save quests')).toBeDisabled()
})
