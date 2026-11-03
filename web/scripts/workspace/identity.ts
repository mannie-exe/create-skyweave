import { createHash } from 'node:crypto'
import { assertJson } from '../../src/lib/workspace/contracts.ts'

export function canonical(value: unknown): string {
  assertJson(value, Number.MAX_SAFE_INTEGER)
  function encode(item: unknown): string {
    if (Array.isArray(item)) return '[' + item.map(encode).join(',') + ']'
    if (item && typeof item === 'object')
      return (
        '{' +
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => JSON.stringify(key) + ':' + encode(child))
          .join(',') +
        '}'
      )
    return JSON.stringify(item)!
  }
  return encode(value)
}
export const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex')
