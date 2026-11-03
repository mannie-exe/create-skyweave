import type {
  ErrorCode,
  Failure,
  Recovery,
} from '../../src/lib/workspace/contracts.ts'
import { boundedText } from '../../src/lib/workspace/contracts.ts'

export class WorkspaceError extends Error {
  readonly code: ErrorCode
  readonly recovery: Recovery
  readonly details?: Record<string, unknown>
  constructor(
    code: ErrorCode,
    message: string,
    recovery: Recovery = 'never',
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.code = code
    this.recovery = recovery
    this.details = details
  }
}

export function failure(error: unknown): Failure {
  if (error instanceof WorkspaceError)
    return {
      code: error.code,
      message: boundedText(error.message, 4096),
      recovery: error.recovery,
      ...(error.details ? { details: error.details } : {}),
    }
  return {
    code: 'STORAGE_UNAVAILABLE',
    message: 'The workspace could not complete this operation.',
    recovery: 'after-refresh',
  }
}

export function invalid(message = 'Invalid operation input'): never {
  throw new WorkspaceError('INVALID_INPUT', message)
}
