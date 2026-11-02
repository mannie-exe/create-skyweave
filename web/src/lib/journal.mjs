// The same authored sections compiled by scripts/generate-journal.py. This module
// edits source documents; it never writes generated Questlog files.
export const localePath = (id) => `journal/locales/${id}.json`
const chapterPath = (id) => `journal/chapters/${id}.json`
export const encode = (value) => JSON.stringify(value, null, 2) + '\n'
function overlay(base, patch) {
  if (base && typeof base === 'object' && !Array.isArray(base))
    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [
        key,
        Object.hasOwn(patch || {}, key)
          ? overlay(value, patch[key])
          : structuredClone(value),
      ]),
    )
  return structuredClone(patch)
}
export function localeText(documents, locale) {
  const english = documents[localePath('en_us')]
  return locale === 'en_us'
    ? english
    : overlay(english, documents[localePath(locale)])
}
export function chapterList(documents) {
  return Object.entries(documents)
    .filter(([name]) => name.startsWith('journal/chapters/'))
    .map(([name, data]) => ({
      id: name.split('/').at(-1).slice(0, -5),
      ...data,
    }))
    .sort(
      (a, b) => a.chapter.order - b.chapter.order || a.id.localeCompare(b.id),
    )
}
export function entryList(documents) {
  return chapterList(documents).flatMap((chapter) =>
    [...chapter.entries]
      .sort(
        (a, b) =>
          (a.definition.sort_order ?? 0) - (b.definition.sort_order ?? 0) ||
          a.id.localeCompare(b.id),
      )
      .map((entry) => ({ ...entry, id: chapter.id + '/' + entry.id })),
  )
}
function objectivePaths(objectives, prefix = '') {
  return objectives.flatMap((objective, index) => {
    const key = prefix + index
    return [key, ...objectivePaths(objective.objectives || [], key + '.')]
  })
}
export function createEntry(documents, chapter, id, title, item) {
  if (!/^[a-z0-9_]+$/.test(id))
    throw new Error(
      'Use lowercase letters, numbers and underscores for the ID.',
    )
  const result = structuredClone(documents),
    source = result[chapterPath(chapter)]
  if (!source) throw new Error('Choose an existing chapter.')
  if (source.entries.some((entry) => entry.id === id))
    throw new Error('This entry ID already exists in this chapter.')
  if (!title.trim() || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(item))
    throw new Error('Enter a title and namespaced item ID.')
  source.entries.push({
    id,
    definition: {
      chapter: `questlog:${chapter}`,
      sort_order:
        Math.max(
          -10,
          ...source.entries.map((e) => e.definition.sort_order || 0),
        ) + 10,
      icon: { item },
      requirements: [],
      objectives: [{ type: 'questlog:item_obtain', item, required_amount: 1 }],
      rewards: [],
    },
  })
  result[localePath('en_us')].entries[chapter + '/' + id] = {
    title,
    flavor: '',
    requirements: `Have at least 1 ${title} in your inventory at once.`,
    description: [],
    disclaimer: null,
    labels: { 0: title },
  }
  return result
}
export function removeEntry(documents, id) {
  // Block rather than quietly rewrite progression prerequisites or unknown native references.
  for (const entry of entryList(documents)) {
    if (
      entry.id !== id &&
      JSON.stringify(entry.definition).includes(
        JSON.stringify('questlog:' + id),
      )
    )
      throw new Error(
        `Referenced by ${entry.id}. Remove that reference before deleting.`,
      )
  }
  const result = structuredClone(documents),
    [chapter, key] = id.split('/')
  result[chapterPath(chapter)].entries = result[
    chapterPath(chapter)
  ].entries.filter((e) => e.id !== key)
  for (const [name, locale] of Object.entries(result))
    if (name.startsWith('journal/locales/')) delete locale.entries?.[id]
  return result
}
export function updateDefinition(documents, id, definition) {
  if (
    !Array.isArray(definition.objectives) ||
    !definition.objectives.length ||
    !Array.isArray(definition.rewards)
  )
    throw new Error('Define at least one objective and a rewards array.')
  const result = structuredClone(documents),
    [chapter, key] = id.split('/')
  if (definition.chapter !== 'questlog:' + chapter)
    throw new Error('Keep the chapter consistent with the entry ID.')
  result[chapterPath(chapter)].entries.find((e) => e.id === key).definition =
    definition
  const paths = objectivePaths(definition.objectives)
  for (const [name, locale] of Object.entries(result)) {
    if (!name.startsWith('journal/locales/')) continue
    const text = locale.entries?.[id]
    if (!text) continue
    text.labels = Object.fromEntries(
      paths
        .filter(
          (p) =>
            name === localePath('en_us') || Object.hasOwn(text.labels || {}, p),
        )
        .map((p) => [p, text.labels?.[p] || `Objective ${p}`]),
    )
  }
  return result
}
export function stringRows(documents) {
  const text = documents[localePath('en_us')]
  return [
    ...Object.entries(text.shared).map(([key, value]) => ({
      path: ['shared', key],
      group: 'shared',
      title: key,
      value,
      native: 'Composed into entry descriptions',
    })),
    ...chapterList(documents).flatMap((chapter) => [
      {
        path: ['chapters', chapter.id],
        group: chapter.id,
        title: 'Chapter title',
        value: text.chapters[chapter.id],
        native: `createsky.journal.chapter.${chapter.id}`,
      },
      ...entryList(documents)
        .filter((e) => e.id.startsWith(chapter.id + '/'))
        .flatMap(({ id }) => {
          const entry = text.entries[id],
            key = 'createsky.journal.' + id.replace('/', '.')
          return [
            ...['title', 'flavor', 'requirements', 'description'].map(
              (field) => ({
                path: ['entries', id, field],
                group: chapter.id,
                title: `${entry.title} · ${field}`,
                value: entry[field],
                native: key + (field === 'title' ? '.title' : '.description'),
              }),
            ),
            ...Object.entries(entry.labels).map(([position, value]) => ({
              path: ['entries', id, 'labels', position],
              group: chapter.id,
              title: `${entry.title} · objective ${position}`,
              value,
              native: key + '.objective.' + position,
            })),
          ]
        }),
    ]),
  ]
}
export const atPath = (value, path) =>
  path.reduce((at, key) => at?.[key], value)
export function setText(documents, locale, path, value) {
  const result = structuredClone(documents)
  let parent = result[localePath(locale)]
  for (const key of path.slice(0, -1)) parent = parent[key] ??= {}
  if (value === undefined) delete parent[path.at(-1)]
  else parent[path.at(-1)] = value
  return result
}

// Guard the editor's rendering contract before applying advanced source JSON.
// The Python compiler remains the authority for save/generation validation.
export function assertJournalShape(documents) {
  const object = (value) =>
    value && typeof value === 'object' && !Array.isArray(value)
  const english = documents[localePath('en_us')]
  if (
    !object(english) ||
    !object(english.entries) ||
    !object(english.shared) ||
    !object(english.chapters)
  )
    throw new Error(
      'English source needs entries, shared and chapters objects.',
    )
  const entries = entryList(documents),
    ids = entries.map((e) => e.id)
  if (
    ids.length !== Object.keys(english.entries).length ||
    ids.some((id) => !english.entries[id])
  )
    throw new Error(
      'Mechanics and English entry IDs must match. Use entry CRUD for coordinated changes.',
    )
  for (const [name, data] of Object.entries(documents)) {
    if (!name.startsWith('journal/locales/')) continue
    if (!object(data) || data.schema !== 1)
      throw new Error('Locale source must be a schema 1 object.')
    for (const key of ['entries', 'shared', 'chapters'])
      if (data[key] !== undefined && !object(data[key]))
        throw new Error(`${key} must be an object.`)
    const locale = localeText(documents, name.split('/').at(-1).slice(0, -5))
    for (const id of ids) {
      const text = locale.entries[id]
      if (
        !object(text) ||
        ['title', 'flavor', 'requirements'].some(
          (k) => typeof text[k] !== 'string',
        ) ||
        !Array.isArray(text.description) ||
        text.description.some((p) => typeof p !== 'string') ||
        !object(text.labels) ||
        Object.values(text.labels).some((v) => typeof v !== 'string')
      )
        throw new Error(`Invalid text sections for ${id}.`)
    }
  }
  for (const { id, definition } of entries)
    if (
      !object(definition) ||
      !Array.isArray(definition.objectives) ||
      !Array.isArray(definition.rewards)
    )
      throw new Error(`Invalid mechanics for ${id}.`)
}
