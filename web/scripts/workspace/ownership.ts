import os from 'node:os'
import { z } from 'zod'
import { scopeSchema, type Scope } from '../../src/lib/workspace/contracts.ts'

export const ownerSchema = z.strictObject({
  schema: z.literal(1),
  scope: scopeSchema,
  session: z.uuid(),
  operationId: z.uuid(),
  pid: z.number().int().positive().max(2147483647),
  hostname: z.string().min(1).max(255),
})
export function operationOwner(
  scope: Scope,
  context: { session?: string; operationId?: string },
) {
  return ownerSchema.parse({
    schema: 1,
    scope,
    session: context.session,
    operationId: context.operationId,
    pid: process.pid,
    hostname: os.hostname(),
  })
}

/** Signal zero observes existence; it never adopts or terminates a job. */
export function processPresence(
  pid: unknown,
  hostname: unknown,
): 'present' | 'absent' | 'unknown' {
  if (
    hostname !== os.hostname() ||
    !Number.isInteger(pid) ||
    Number(pid) <= 0 ||
    Number(pid) > 2147483647
  )
    return 'unknown'
  try {
    process.kill(Number(pid), 0)
    return 'present'
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH'
      ? 'absent'
      : 'unknown'
  }
}
export function processGroupPresence(
  pid: unknown,
  hostname: unknown,
): 'present' | 'absent' | 'unknown' {
  if (
    process.platform === 'win32' ||
    hostname !== os.hostname() ||
    !Number.isInteger(pid) ||
    Number(pid) <= 0 ||
    Number(pid) > 2147483647
  )
    return 'unknown'
  try {
    process.kill(-Number(pid), 0)
    return 'present'
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH'
      ? 'absent'
      : 'unknown'
  }
}
