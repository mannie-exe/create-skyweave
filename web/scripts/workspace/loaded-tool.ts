import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { hash } from './identity.ts'
import { WorkspaceError } from './errors.ts'

/** Refuse to label loaded adapter code with the bytes of a later edit. */
export function loadedTool(url: string) {
  const file = fileURLToPath(url),
    revision = hash(readFileSync(file))
  return async () => {
    if (hash(await fs.readFile(file)) !== revision)
      throw new WorkspaceError(
        'CAPABILITY_UNAVAILABLE',
        'Authoring code changed. Restart the Atlas server before generating.',
        'reconnect',
      )
    return revision
  }
}
