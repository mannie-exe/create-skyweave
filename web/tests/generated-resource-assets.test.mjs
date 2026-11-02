import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generatedResourceAssets } from '../scripts/generated-resource-assets.mjs'

test('new generated files are served after middleware creation; foreign paths and symlinks are rejected', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-assets-'))
  try {
    const serve = generatedResourceAssets(root)
    const folder = path.join(root, 'public/generated/objects/previews')
    await fs.mkdir(folder, { recursive: true })
    const name = 'a'.repeat(64) + '.json',
      url = '/generated/objects/previews/' + name
    await fs.writeFile(path.join(folder, name), '{"fresh":true}')
    async function request(url, method = 'GET') {
      const result = {}
      await serve(
        { url, method },
        {
          writeHead(status, headers) {
            Object.assign(result, { status, headers })
          },
          end(body) {
            result.body = body
          },
        },
        () => {
          result.next = true
        },
      )
      return result
    }
    const result = await request(url)
    assert.equal(result.status, 200)
    assert.equal(String(result.body), '{"fresh":true}')
    assert.equal(result.headers['Cache-Control'], 'no-store')
    assert.equal((await request(url, 'HEAD')).body, undefined)
    assert.equal(
      (await request('/generated/objects/../../secret.json')).next,
      true,
    )
    assert.equal(
      (await request('/generated/objects/index.json', 'POST')).next,
      true,
    )
    const target = path.join(root, 'elsewhere.json')
    await fs.writeFile(target, 'secret')
    await fs.symlink(
      target,
      path.join(root, 'public/generated/objects/index.json'),
    )
    assert.equal((await request('/generated/objects/index.json')).status, 400)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
