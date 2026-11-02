import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { jobs } from './jobs.mjs'

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')

export function modelAuthoring(pack) {
  const file = path.join(pack, 'authoring/model-recipes.json')
  const pins = path.join(pack, 'authoring/resource-patches.json')
  const selections = path.join(pack, 'authoring/resource-selections.json')
  const textures = path.join(pack, 'authoring/texture-resources.json')
  async function source() {
    for (const name of [file, pins, selections, textures])
      if ((await fs.realpath(name)) !== name)
        throw new Error('Model authoring symlinks are not supported')
    const text = await fs.readFile(file, 'utf8')
    const pinText = await fs.readFile(pins, 'utf8')
    const selectionText = await fs.readFile(selections, 'utf8')
    const textureText = await fs.readFile(textures, 'utf8')
    return {
      text,
      revision: hash(
        text + '\n' + pinText + '\n' + selectionText + '\n' + textureText,
      ),
    }
  }
  async function preview(document, validate = false) {
    const result = await jobs.run(
      validate ? 'models.validate' : 'models.preview',
      { pack },
      { document },
    )
    return JSON.parse(result.stdout)
  }
  async function expectRevision(revision) {
    const current = await source()
    if (current.revision !== revision)
      throw new Error(
        'Model source or resource inputs changed. Reload before saving or generating.',
      )
    return current
  }
  return {
    async read() {
      const current = await source()
      const document = JSON.parse(current.text)
      return {
        document,
        revision: current.revision,
        ...(await preview(document)),
      }
    },
    preview,
    async save(input) {
      await expectRevision(input.revision)
      await preview(input.document, true)
      await expectRevision(input.revision)
      const text = JSON.stringify(input.document, null, 2) + '\n'
      await fs.writeFile(file + '.tmp', text, { flag: 'wx' })
      try {
        await fs.rename(file + '.tmp', file)
      } catch (error) {
        await fs.unlink(file + '.tmp')
        throw error
      }
      return { revision: (await source()).revision }
    },
    async generate(input) {
      await expectRevision(input.revision)
      const { stdout: output } = await jobs.run('resources.generate', { pack })
      await expectRevision(input.revision)
      return { output: output.trim() }
    },
  }
}
