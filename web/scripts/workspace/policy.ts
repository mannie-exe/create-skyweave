import {
  actionSchema,
  scopeSchema,
  targetSchema,
  type Action,
  type Scope,
  type Target,
  type Artifact,
} from '../../src/lib/workspace/contracts.ts'

export type Context = Readonly<{
  principal: Readonly<{ kind: 'anonymous' | 'user' | 'machine'; id: string }>
  connectionId: string
}>
export type Grant = { action: Action; target: Target }
export const artifactRead = (artifact: Artifact): Grant => ({
  action: 'artifact.read',
  target: target(artifact.scope, 'artifact', artifact.id),
})
type Decision =
  { allowed: true } | { allowed: false; reason: 'unavailable' | 'forbidden' }
export type Policy = {
  mode: 'open' | 'restricted'
  decide(
    context: Context,
    action: Action,
    target: Target,
  ): Decision | Promise<Decision>
}

export const openPolicy: Policy = {
  mode: 'open',
  decide(_context, action, target) {
    actionSchema.parse(action)
    targetSchema.parse(target)
    return { allowed: true }
  },
}
export function target(scope: Scope, kind: Target['kind'], id: string): Target {
  return targetSchema.parse({ ...scopeSchema.parse(scope), kind, id })
}
export function scopeKey(scope: Scope): string {
  return `${scope.workspaceId}/${scope.packId}`
}

/** Restrictive providers cannot contain Vite modules or an already public build. */
export function admitDelivery(
  mode: 'open-local' | 'open-static' | 'service',
  policy: Policy,
) {
  if (mode !== 'service' && policy.mode !== 'open')
    throw new Error(
      'Restrictive policy requires a protected delivery host; Vite and open snapshots are not supported',
    )
}
