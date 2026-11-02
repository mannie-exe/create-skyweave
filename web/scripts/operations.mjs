import { randomUUID } from 'node:crypto'

// User actions span validation, file writes and multiple named subprocesses.
const actions = {
  '/__atlas/objects/inputs': [
    'Fetch candidate resource inputs',
    '/resource-authoring',
    'Resource preview inputs ready',
  ],
  '/__atlas/objects/generate': [
    'Refresh resource objects',
    '/resource-authoring',
    'Resource object previews refreshed. Pack sources were not changed.',
  ],
  '/__atlas/objects/export': [
    'Export static model definitions',
    '/resource-authoring',
    'Static model definitions exported. No Minecraft instance was started.',
  ],
  '/__atlas/textures/generate': [
    'Rebuild texture previews',
    '/resource-authoring?view=textures',
    'Texture previews rebuilt. Installed packs were not changed.',
  ],
  '/__atlas/resource-reviews/save': [
    'Save resource review',
    '/resourcepacks/reviews',
    'Review saved. Pack selections were not changed.',
  ],
  '/__atlas/authoring/save': [
    'Save journal source',
    '/authoring',
    'Source saved. Generate to update Questlog files.',
  ],
  '/__atlas/authoring/generate': [
    'Generate Questlog files',
    '/authoring',
    'Questlog files generated. Instances were not changed.',
  ],
  '/__atlas/authoring/audit': [
    'Check config files',
    '/authoring?view=audit',
    'Config files checked.',
  ],
  '/__atlas/models/save': [
    'Save model source',
    '/resource-authoring?view=models',
    'Model source saved.',
  ],
  '/__atlas/models/generate': [
    'Generate resource patches',
    '/resource-authoring?view=models',
    'Resource patches generated. Instances were not changed.',
  ],
  '/__atlas/refresh': [
    'Refresh implementation',
    '/',
    'Implementation refreshed. World surveys retain their separate date.',
  ],
  '/__atlas/export': [
    'Export recipe scenario',
    '/',
    'Recipe scenario exported.',
  ],
}

export function createOperations() {
  const session = randomUUID()
  let current = null
  let successMessage = ''
  const history = []
  return {
    begin(method, url, input = {}) {
      let definition =
        actions[url] ||
        (method === 'POST' && url.startsWith('/__atlas/domain/')
          ? [
              'Save map source',
              '/',
              'Source saved and map rebuilt. Runtime evidence preserved.',
            ]
          : null)
      if (url === '/__atlas/authoring/save') {
        const names =
          input.changes && typeof input.changes === 'object'
            ? Object.keys(input.changes)
            : [input.name].filter(Boolean)
        if (
          !names.length ||
          !names.every(
            (name) => typeof name === 'string' && name.startsWith('journal/'),
          )
        )
          definition = [
            'Save authoring source',
            '/authoring?view=source',
            'Source saved.',
          ]
      }
      if (
        !definition ||
        (method !== 'POST' && url !== '/__atlas/authoring/audit')
      )
        return null
      if (current) throw new Error('An operation is already running')
      successMessage = definition[2]
      current = {
        id: randomUUID(),
        label: definition[0],
        href: definition[1],
        message: '',
        state: 'running',
        startedAt: new Date().toISOString(),
      }
      return current.id
    },
    finish(id, error, code) {
      if (!id || current?.id !== id) return
      const result = {
        ...current,
        message: successMessage,
        state: error
          ? code === 'cancelled'
            ? 'cancelled'
            : 'failed'
          : 'succeeded',
        finishedAt: new Date().toISOString(),
      }
      if (error) result.message = String(error).slice(0, 16000)
      history.unshift(result)
      history.length = Math.min(history.length, 20)
      current = null
    },
    snapshot(job = null) {
      return {
        session,
        current: current ? { ...current, job } : null,
        history: history.map((result) => ({ ...result })),
      }
    },
  }
}
