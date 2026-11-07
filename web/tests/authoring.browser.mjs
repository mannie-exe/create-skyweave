import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mockWorkspace } from './workspace-fixture.mjs'
import { createHash } from 'node:crypto'
const source = fileURLToPath(new URL('../../authoring', import.meta.url))
async function fixture(page, live = false) {
  const files = {}
  for (const dir of [
    'journal',
    'journal/chapters',
    'journal/locales',
    'changes',
  ])
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
      if (['journal.save', 'config.source.save'].includes(operation)) {
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
      if (operation === 'journal.generate') {
        state.generated++
        return { output: 'Generated' }
      }
      if (operation === 'journal.preview') {
        state.previews++
        return artifact({
          changed: state.generated ? [] : ['quest.json'],
          removed: [],
          outputs: 57,
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
      'journal.read',
      'journal.preview',
      'journal.save',
      'config.source.save',
      'journal.generate',
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
const en = (state) => JSON.parse(state.files['journal/locales/en_us.json'].text)

test('external journal changes refresh clean text, preserve drafts and never start preview jobs', async ({
  page,
}) => {
  const state = await fixture(page, true)
  await button(page, 'Localization').click()
  await page
    .getByLabel('Find key or text', { exact: true })
    .fill('entries.travel/glider.title')
  const field = page.getByLabel('Source entries.travel/glider.title', {
    exact: true,
  })
  const before = state.previews
  function change(title) {
    const document = en(state)
    document.entries['travel/glider'].title = title
    state.files['journal/locales/en_us.json'].text = JSON.stringify(document)
    state.saves++
    state.wire.emit('sources', {
      kind: 'invalidated',
      sources: ['journal/locales/en_us.json'],
      external: true,
    })
  }
  change('External glider')
  await expect(field).toHaveValue('External glider')
  expect(state.previews).toBe(before)
  const valid = state.files['journal/locales/en_us.json'].text
  state.files['journal/locales/en_us.json'].text = '{'
  state.saves++
  state.wire.emit('sources', {
    kind: 'invalidated',
    sources: ['journal/locales/en_us.json'],
    external: true,
  })
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'invalid JSON. The current view was kept.' }),
  ).toBeVisible()
  await expect(field).toHaveValue('External glider')
  state.files['journal/locales/en_us.json'].text = valid
  await field.fill('Unsaved glider')
  change('Another external glider')
  await expect(
    page.getByRole('status').filter({ hasText: 'Your draft is preserved' }),
  ).toBeVisible()
  await expect(field).toHaveValue('Unsaved glider')
  expect(state.previews).toBe(before)
  expect(state.generated).toBe(0)
})

test('acknowledged saves remain saved when the follow-up read fails', async ({
  page,
}) => {
  const state = await fixture(page)
  await button(page, 'Localization').click()
  await page
    .getByLabel('Find key or text', { exact: true })
    .fill('entries.travel/glider.title')
  await page
    .getByLabel('Source entries.travel/glider.title', { exact: true })
    .fill('Saved glider')
  state.failRead = true
  await button(page, 'Save journal').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'View refresh failed' }),
  ).toContainText('Source saved')
  expect(en(state).entries['travel/glider'].title).toBe('Saved glider')
  await expect(button(page, 'Save journal')).toBeDisabled()
  await expect(button(page, 'Generate Questlog files')).toBeDisabled()
  await expect(
    page.getByLabel('Source entries.travel/glider.title', { exact: true }),
  ).toHaveValue('Saved glider')
  await button(page, 'Reload source').click()
  await expect(button(page, 'Generate Questlog files')).toBeEnabled()
})

test('journal CRUD coordinates human-readable strings, mechanics and rewards', async ({
  page,
}) => {
  const state = await fixture(page)
  await button(page, 'New entry').click()
  await page.getByLabel('Entry ID', { exact: true }).fill('test_route')
  await page.getByLabel('English title', { exact: true }).fill('Test route')
  await page
    .getByLabel('Obtain item ID', { exact: true })
    .fill('minecraft:iron_ingot')
  await button(page, 'Create entry').click()
  await expect(
    page.getByRole('heading', { name: 'Test route', exact: true }).first(),
  ).toBeVisible()
  await button(page, 'Add reward').click()
  await page.getByLabel('Count', { exact: true }).fill('2')
  await button(page, 'Edit strings').click()
  await page
    .getByLabel('Source entries.travel/test_route.title', { exact: true })
    .fill('A revised route')
  await page
    .getByLabel('Source entries.travel/test_route.description', { exact: true })
    .fill('First paragraph.\n\nSecond paragraph.')
  await button(page, 'Entries').click()
  await expect(
    page.getByRole('region', { name: 'Journal text preview' }),
  ).toContainText('A revised route')
  await expect(page.getByLabel('Count', { exact: true })).toHaveValue('2')
  await expect(button(page, 'Generate Questlog files')).toBeDisabled()
  await button(page, 'Save journal').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Source saved' }),
  ).toBeVisible()
  expect(en(state).entries['travel/test_route'].description).toEqual([
    'First paragraph.',
    'Second paragraph.',
  ])
  expect(
    JSON.parse(state.files['journal/chapters/travel.json'].text).entries.find(
      (e) => e.id === 'test_route',
    ).definition.rewards[0].count,
  ).toBe(2)
  expect(state.generated).toBe(0)
  await button(page, 'Generate Questlog files').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Instances were not changed' }),
  ).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await button(page, 'Delete entry').click()
  await button(page, 'Save journal').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Source saved' }),
  ).toBeVisible()
  expect(en(state).entries['travel/test_route']).toBeUndefined()
  expect(
    JSON.parse(state.files['journal/chapters/travel.json'].text).entries.some(
      (e) => e.id === 'test_route',
    ),
  ).toBe(false)
})

test('localization groups strings and keeps English fallback explicit', async ({
  page,
}) => {
  const state = await fixture(page)
  await button(page, 'Localization').click()
  await page.getByText('Manage locales', { exact: true }).click()
  const picker = page.getByLabel('Language to add', { exact: true })
  await expect(button(page, 'Add locale')).toBeDisabled()
  await expect(picker.locator('option[value="en_us"]')).toHaveCount(0)
  await expect(picker.locator('option[value="esan"]')).toHaveCount(1)
  await expect(picker.locator('option[value="es_419"]')).toHaveCount(0)
  await picker.selectOption('de_de')
  await button(page, 'Add locale').click()
  await expect(picker.locator('option[value="de_de"]')).toHaveCount(0)
  await expect(button(page, 'Add locale')).toBeDisabled()
  await expect(
    page
      .getByLabel('Editing locale', { exact: true })
      .locator('option:checked'),
  ).toHaveText('Deutsch (Deutschland) · de_de')
  await page
    .getByLabel('Find key or text', { exact: true })
    .fill('entries.travel/glider.title')
  await expect(
    page.getByText('English fallback', { exact: true }),
  ).toBeVisible()
  await page
    .getByLabel('Translation entries.travel/glider.title', { exact: true })
    .fill('Gleiter')
  await button(page, 'Entries').click()
  await expect(
    page.getByRole('region', { name: 'Journal text preview' }),
  ).toContainText('Gleiter')
  await expect(
    page.getByRole('region', { name: 'Journal text preview' }),
  ).toContainText('Have at least 1 Glider')
  await button(page, 'Save journal').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Source saved' }),
  ).toBeVisible()
  expect(
    JSON.parse(state.files['journal/locales/de_de.json'].text).entries[
      'travel/glider'
    ],
  ).toEqual({ title: 'Gleiter' })
  await button(page, 'Localization').click()
  await page
    .getByLabel('Find key or text', { exact: true })
    .fill('entries.travel/glider.title')
  await button(page, 'Use English').click()
  await expect(
    page.getByText('English fallback', { exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('shared disclaimers have CRUD, readable references and protected deletion', async ({
  page,
}) => {
  const state = await fixture(page)
  await button(page, 'Disclaimers').click()
  await expect(button(page, 'Delete disclaimer')).toBeDisabled()
  await button(page, 'New disclaimer').click()
  await page.getByLabel('Key', { exact: true }).fill('test_note')
  await page
    .getByLabel('English message', { exact: true })
    .fill('A shared note.')
  await button(page, 'Create disclaimer').click()
  await button(page, 'Entries').click()
  await page
    .getByRole('combobox', { name: 'Shared disclaimer', exact: true })
    .selectOption('test_note')
  await button(page, 'Manage disclaimers').click()
  await page
    .getByRole('navigation', { name: 'Disclaimers', exact: true })
    .getByRole('button', { name: 'A shared note.' })
    .click()
  await expect(button(page, 'Delete disclaimer')).toBeDisabled()
  await expect(button(page, 'Glider')).toBeVisible()
  await button(page, 'Edit localized message').click()
  await page
    .getByLabel('Source shared.test_note', { exact: true })
    .fill('Changed shared text.')
  await button(page, 'Entries').click()
  await expect(
    page.getByRole('region', { name: 'Journal text preview' }),
  ).toContainText('Changed shared text.')
  await page
    .getByRole('combobox', { name: 'Shared disclaimer', exact: true })
    .selectOption('')
  await button(page, 'Disclaimers').click()
  await page
    .getByRole('navigation', { name: 'Disclaimers', exact: true })
    .getByRole('button', { name: 'Changed shared text.' })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await button(page, 'Delete disclaimer').click()
  await button(page, 'Save journal').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Source saved' }),
  ).toBeVisible()
  expect(en(state).shared.test_note).toBeUndefined()
})

test('failed saves and unapplied JSON retain drafts across views', async ({
  page,
}) => {
  const state = await fixture(page)
  await page
    .getByText('Edit conditions and entry properties', { exact: true })
    .click()
  await page.getByLabel('Definition JSON', { exact: true }).fill('{bad')
  await button(page, 'Apply definition json').click()
  await expect(page.getByRole('alert')).toContainText('SyntaxError')
  await button(page, 'Localization').click()
  await button(page, 'Entries').click()
  await page
    .getByText('Edit conditions and entry properties', { exact: true })
    .click()
  await expect(page.getByLabel('Definition JSON', { exact: true })).toHaveValue(
    '{bad',
  )
  await expect(button(page, 'Save journal')).toBeDisabled()
  await button(page, 'Discard JSON edit').click()
  await button(page, 'Edit strings').click()
  await page
    .getByLabel('Source entries.travel/glider.requirements', { exact: true })
    .fill('Unsaved condition.')
  state.fail = true
  await button(page, 'Save journal').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'File changed on disk' }),
  ).toBeVisible()
  await expect(
    page.getByLabel('Source entries.travel/glider.requirements', {
      exact: true,
    }),
  ).toHaveValue('Unsaved condition.')
  await expect(button(page, 'Save journal')).toBeEnabled()
  expect(en(state).entries['travel/glider'].requirements).not.toBe(
    'Unsaved condition.',
  )
})

test('real source audit and local write boundaries remain available', async ({
  page,
  request,
}) => {
  await page.goto('/authoring')
  await expect(
    page.getByRole('status').filter({ hasText: 'Source loaded' }),
  ).toBeVisible()
  const nav = page.getByRole('navigation', {
    name: 'Authoring views',
    exact: true,
  })
  await expect(nav.getByRole('link', { name: 'Resources' })).toHaveAttribute(
    'href',
    '/resource-authoring',
  )
  const generationStatus = page
    .locator('p.scope')
    .filter({ hasText: 'Questlog files ·' })
  await expect(generationStatus).toBeVisible()
  await button(page, 'Source JSON').click()
  await expect(generationStatus).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Source file', exact: true })
    .selectOption('changes/structures.json')
  await expect(generationStatus).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Source file', exact: true })
    .selectOption('journal/defaults.json')
  await expect(generationStatus).toBeVisible()
  await button(page, 'Config audit').click()
  await expect(generationStatus).toHaveCount(0)
  await expect(button(page, 'Generate Questlog files')).toHaveCount(0)
  await button(page, 'Check files').click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Config files checked' }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption('structures')
  await expect(page.locator('tbody')).toContainText(
    'resource-patches/data/skyvillages/worldgen/processor_list/house_processor.json',
  )
  const data = { name: '../../outside', revision: '0'.repeat(64), text: '{}' }
  expect(
    (
      await request.post('/__atlas/authoring/save', {
        data,
        headers: { Origin: 'http://example.com' },
      })
    ).status(),
  ).toBe(403)
  const traversal = await page.evaluate(async (input) => {
    const { workspaceClient } = await import('/src/lib/workspace/client.ts')
    try {
      await workspaceClient.command('journal.save', input)
    } catch (error) {
      return error.failure
    }
  }, data)
  expect(traversal.code).toBe('INVALID_INPUT')
  expect(traversal.message).toBe('Unknown authoring file')
  expect(
    (
      await request.post('/__atlas/authoring/save', {
        data,
        headers: { Origin: 'http://127.0.0.1:4322' },
      })
    ).status(),
  ).toBe(405)
})
