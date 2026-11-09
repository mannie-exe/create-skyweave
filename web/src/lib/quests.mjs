// Authored FTB mechanics and locale prose. Native saves/progress are never edited here.
export const localePath = (id) => `quests/locales/${id}.json`
export const chapterPath = (key) => `quests/chapters/${key}.json`
export const encode = (value) => JSON.stringify(value, null, 2) + '\n'
const keyPattern = /^[a-z0-9_]+$/
const codePattern = /^[0-7][0-9A-F]{15}$/
export const atPath = (value, path) =>
  path.reduce((at, key) => at?.[key], value)
export function localeText(documents, locale) {
  const english = documents[localePath('en_us')],
    override = documents[localePath(locale)] ?? {}
  if (!english) throw new Error('English quest text is missing.')
  return {
    schema: 1,
    shared: { ...english.shared, ...override.shared },
    objects: Object.fromEntries(
      Object.entries(english.objects).map(([id, words]) => [
        id,
        { ...words, ...override.objects?.[id] },
      ]),
    ),
  }
}
export function chapterList(documents) {
  return Object.entries(documents)
    .filter(([name]) => /^quests\/chapters\/[a-z0-9_]+\.json$/.test(name))
    .map(([source, chapter]) => ({
      ...chapter,
      native: chapter.native ?? {},
      source,
      key: source.split('/').at(-1).slice(0, -5),
    }))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
}
export function questList(documents) {
  return chapterList(documents).flatMap((chapter) =>
    chapter.quests.map((quest) => ({
      ...quest,
      native: quest.native ?? {},
      chapterKey: chapter.key,
      chapterId: chapter.id,
    })),
  )
}
export function objectList(documents) {
  return [
    ...(documents['quests/book.json']?.groups ?? []).map((group) => ({
      ...group,
      type: 'chapter_group',
      chapterKey: 'book',
    })),
    ...chapterList(documents).flatMap((chapter) => [
      { ...chapter, type: 'chapter', chapterKey: chapter.key },
      ...chapter.quests.flatMap((quest) => [
        { ...quest, type: 'quest', chapterKey: chapter.key },
        ...quest.tasks.map((task) => ({
          ...task,
          type: 'task',
          nativeType: task.type,
          parent: quest.id,
          chapterKey: chapter.key,
        })),
        ...quest.rewards.map((reward) => ({
          ...reward,
          type: 'reward',
          nativeType: reward.type,
          parent: quest.id,
          chapterKey: chapter.key,
        })),
      ]),
    ]),
  ]
}
export function newCode(documents, reserved = []) {
  const used = new Set([
    ...objectList(documents).map((row) => row.id),
    ...reserved,
  ])
  for (let attempt = 0; attempt < 128; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    bytes[0] &= 0x7f
    const id = [...bytes]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    if (id !== '0000000000000000' && id !== '0000000000000001' && !used.has(id))
      return id
  }
  throw new Error('Could not allocate a unique quest ID. Try again.')
}
function title(value) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Enter a title.')
  return value.trim()
}
function key(value) {
  if (typeof value !== 'string' || !keyPattern.test(value))
    throw new Error(
      'Use lowercase letters, numbers and underscores for the source key.',
    )
  return value
}
const defaultWords = (kind, text) => ({
  title: text,
  ...(kind === 'chapter'
    ? { chapter_subtitle: [] }
    : kind === 'quest'
      ? { quest_subtitle: '', quest_desc: [] }
      : {}),
})
function removeWords(documents, ids) {
  for (const [name, value] of Object.entries(documents))
    if (name.startsWith('quests/locales/'))
      for (const id of ids) delete value.objects?.[id]
}
export function createChapter(documents, name, text, icon = 'minecraft:book') {
  key(name)
  if (documents[chapterPath(name)])
    throw new Error('This chapter source key already exists.')
  const result = structuredClone(documents),
    id = newCode(result)
  result[chapterPath(name)] = {
    schema: 1,
    id,
    order: Math.max(-1, ...chapterList(result).map((row) => row.order)) + 1,
    native: { icon },
    quests: [],
  }
  result[localePath('en_us')].objects[id] = defaultWords('chapter', title(text))
  return result
}
export function removeChapter(documents, name) {
  const chapter = documents[chapterPath(name)]
  if (!chapter) throw new Error('Chapter not found.')
  if (chapter.quests.length)
    throw new Error('Move or delete this chapter’s quests first.')
  const result = structuredClone(documents)
  delete result[chapterPath(name)]
  removeWords(result, [chapter.id])
  return result
}
export function updateChapter(documents, name, changes) {
  const result = structuredClone(documents),
    chapter = result[chapterPath(name)]
  if (!chapter) throw new Error('Chapter not found.')
  if (changes.id && changes.id !== chapter.id)
    throw new Error('Keep the chapter’s native ID stable.')
  result[chapterPath(name)] = { ...chapter, ...changes, id: chapter.id }
  return result
}
export function createGroup(documents, name, text) {
  key(name)
  const result = structuredClone(documents),
    book = result['quests/book.json']
  if (book.groups.some((row) => row.key === name))
    throw new Error('This group key already exists.')
  const id = newCode(result)
  book.groups.push({ id, key: name, native: {} })
  result[localePath('en_us')].objects[id] = defaultWords(
    'chapter_group',
    title(text),
  )
  return result
}
export function removeGroup(documents, id) {
  if (chapterList(documents).some((row) => row.group === id))
    throw new Error('Reassign the group’s chapters first.')
  const result = structuredClone(documents)
  result['quests/book.json'].groups = result['quests/book.json'].groups.filter(
    (row) => row.id !== id,
  )
  removeWords(result, [id])
  return result
}
export function createQuest(documents, chapter, name, text, item) {
  key(name)
  if (questList(documents).some((row) => row.key === name))
    throw new Error('This quest source key already exists.')
  if (!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(item))
    throw new Error('Enter a namespaced item ID.')
  const result = structuredClone(documents),
    source = result[chapterPath(chapter)]
  if (!source) throw new Error('Choose a chapter.')
  const id = newCode(result),
    taskId = newCode(result, [id])
  source.quests.push({
    id,
    key: name,
    x: 0,
    y: Math.max(-3, ...source.quests.map((row) => row.y)) + 3,
    dependencies: [],
    native: { icon: item },
    tasks: [
      {
        id: taskId,
        type: 'item',
        item: { id: item, count: 1 },
        count: 1,
        consume_items: false,
      },
    ],
    rewards: [],
    covers: [],
  })
  result[localePath('en_us')].objects[id] = defaultWords('quest', title(text))
  result[localePath('en_us')].objects[taskId] = defaultWords(
    'task',
    title(text),
  )
  return result
}
export function removeQuest(documents, id) {
  const dependent = questList(documents).find((row) =>
    row.dependencies.includes(id),
  )
  if (dependent)
    throw new Error(
      `Referenced by ${dependent.key}. Remove the dependency first.`,
    )
  if (chapterList(documents).some((row) => row.native?.autofocus_id === id))
    throw new Error('Remove this chapter’s autofocus reference first.')
  const row = questList(documents).find((row) => row.id === id)
  if (!row) throw new Error('Quest not found.')
  const result = structuredClone(documents)
  result[chapterPath(row.chapterKey)].quests = result[
    chapterPath(row.chapterKey)
  ].quests.filter((row) => row.id !== id)
  removeWords(result, [
    id,
    ...row.tasks.map((row) => row.id),
    ...row.rewards.map((row) => row.id),
  ])
  return result
}
export function updateQuest(documents, id, changes, destination) {
  const result = structuredClone(documents),
    before = questList(result).find((row) => row.id === id)
  if (!before) throw new Error('Quest not found.')
  if (changes.id && changes.id !== id)
    throw new Error('Keep the quest’s native ID stable.')
  const source = result[chapterPath(before.chapterKey)],
    index = source.quests.findIndex((row) => row.id === id)
  const next = { ...source.quests[index], ...changes, id }
  if (!next.tasks?.length || !Array.isArray(next.rewards))
    throw new Error('Define at least one task and a rewards array.')
  const remaining = new Set(
    [...next.tasks, ...next.rewards].map((row) => row.id),
  )
  removeWords(
    result,
    [...before.tasks, ...before.rewards]
      .filter((row) => !remaining.has(row.id))
      .map((row) => row.id),
  )
  for (const row of [...next.tasks, ...next.rewards])
    result[localePath('en_us')].objects[row.id] ??= {
      title: row.type === 'item' ? (row.item?.id ?? 'Item choice') : row.type,
    }
  source.quests[index] = next
  if (destination && destination !== before.chapterKey) {
    const target = result[chapterPath(destination)]
    if (!target) throw new Error('Destination chapter not found.')
    source.quests.splice(index, 1)
    target.quests.push(next)
  }
  validateDependencies(result)
  return result
}
function validateDependencies(documents) {
  const quests = new Map(questList(documents).map((row) => [row.id, row])),
    done = new Set()
  function visit(id, active) {
    if (active.has(id)) throw new Error('This dependency would create a cycle.')
    if (done.has(id)) return
    const quest = quests.get(id)
    if (!quest) throw new Error(`Unknown prerequisite: ${id}`)
    active.add(id)
    for (const dep of quest.dependencies) visit(dep, active)
    active.delete(id)
    done.add(id)
  }
  for (const id of quests.keys()) visit(id, new Set())
}
export function setText(documents, locale, path, value) {
  const result = structuredClone(documents)
  let parent = result[localePath(locale)]
  if (!parent) throw new Error('Create the locale before editing it.')
  for (const part of path.slice(0, -1)) parent = parent[part] ??= {}
  if (value === undefined) delete parent[path.at(-1)]
  else parent[path.at(-1)] = value
  return result
}
export function paragraphs(value, shared) {
  return (value ?? []).map((part) =>
    typeof part === 'string'
      ? part
      : (shared[part.shared] ?? `Missing shared text: ${part.shared}`),
  )
}
export function sharedUses(documents, key) {
  if (!key) return []
  const found = new Set()
  for (const [name, locale] of Object.entries(documents)) {
    if (!name.startsWith('quests/locales/')) continue
    for (const [id, words] of Object.entries(locale.objects ?? {}))
      if (
        Object.values(words).some(
          (value) =>
            Array.isArray(value) && value.some((part) => part?.shared === key),
        )
      )
        found.add(id)
  }
  return [...found]
}
export function createShared(documents, name, text) {
  key(name)
  const result = structuredClone(documents),
    english = result[localePath('en_us')]
  if (Object.hasOwn(english.shared, name))
    throw new Error('This shared text key already exists.')
  english.shared[name] = title(text)
  return result
}
export function removeShared(documents, name) {
  if (sharedUses(documents, name).length)
    throw new Error('Remove references before deleting shared text.')
  const result = structuredClone(documents)
  for (const [path, locale] of Object.entries(result))
    if (path.startsWith('quests/locales/')) delete locale.shared?.[name]
  return result
}
export function stringRows(documents) {
  const words = localeText(documents, 'en_us')
  return [
    ...Object.entries(words.shared).map(([key, value]) => ({
      path: ['shared', key],
      group: 'shared',
      title: key,
      value,
      native: 'Composed into descriptions',
    })),
    ...objectList(documents).flatMap((row) =>
      Object.entries(words.objects[row.id] ?? {}).map(([field, value]) => ({
        path: ['objects', row.id, field],
        group: row.chapterKey,
        title: `${words.objects[row.id]?.title ?? row.id} · ${field.replaceAll('_', ' ')}`,
        value,
        native: `${row.type}.${row.id}.${field}`,
      })),
    ),
  ]
}
// Guard the editor's rendering shape. Python remains save/generation authority.
export function assertQuestShape(documents) {
  const object = (value) =>
    value && typeof value === 'object' && !Array.isArray(value)
  const book = documents['quests/book.json'],
    english = documents[localePath('en_us')]
  if (!object(book) || book.schema !== 1 || !Array.isArray(book.groups))
    throw new Error('Quest book needs schema 1 and a groups array.')
  if (!object(english) || !object(english.objects) || !object(english.shared))
    throw new Error('English text needs objects and shared text.')
  for (const chapter of chapterList(documents)) {
    if (chapter.schema !== 1 || !Array.isArray(chapter.quests))
      throw new Error('Invalid chapter source.')
    for (const row of chapter.quests)
      if (
        !Array.isArray(row.tasks) ||
        !row.tasks.length ||
        !Array.isArray(row.rewards) ||
        !Array.isArray(row.dependencies) ||
        !Number.isFinite(row.x) ||
        !Number.isFinite(row.y)
      )
        throw new Error(
          'Quests need tasks, rewards, dependencies and finite layout positions.',
        )
  }
  const rows = objectList(documents),
    ids = rows.map((row) => row.id)
  if (
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) =>
        !codePattern.test(id) ||
        id === '0000000000000000' ||
        id === '0000000000000001',
    )
  )
    throw new Error(
      'Native IDs must be unique unreserved positive signed-long hexadecimal strings (0 and 1 belong to FTB).',
    )
  if (
    ids.length !== Object.keys(english.objects).length ||
    ids.some((id) => !english.objects[id])
  )
    throw new Error('English text must match the complete native object set.')
  for (const [name, locale] of Object.entries(documents)) {
    if (!name.startsWith('quests/locales/')) continue
    if (
      !object(locale) ||
      locale.schema !== 1 ||
      (locale.objects && !object(locale.objects)) ||
      (locale.shared && !object(locale.shared))
    )
      throw new Error('Invalid locale source.')
    if (Object.keys(locale.objects ?? {}).some((id) => !ids.includes(id)))
      throw new Error('Locale references an unknown native object.')
    const resolved = localeText(documents, name.split('/').at(-1).slice(0, -5))
    for (const id of ids) {
      const words = resolved.objects[id]
      if (typeof words.title !== 'string')
        throw new Error('Object titles must be text.')
      for (const [field, value] of Object.entries(words))
        if (field === 'quest_desc' || field === 'chapter_subtitle') {
          if (
            !Array.isArray(value) ||
            value.some(
              (part) =>
                typeof part !== 'string' &&
                (!object(part) ||
                  Object.keys(part).join() !== 'shared' ||
                  typeof resolved.shared[part.shared] !== 'string'),
            )
          )
            throw new Error(
              'Descriptions need text paragraphs or valid shared references.',
            )
        } else if (typeof value !== 'string')
          throw new Error('Titles and subtitles must be text.')
    }
  }
  validateDependencies(documents)
}
