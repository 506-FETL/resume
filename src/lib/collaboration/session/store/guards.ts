import { CollaborationOperationError } from '../service'
import type { CollaborationSessionStore, PreparedGuestSession } from '../types'
import type {
  PendingGuestMembership,
  PendingHostAttempt,
  PendingHostAttemptIdentity,
} from './types'

export function isSamePendingHostAttempt(
  attempt: PendingHostAttempt | null,
  identity: PendingHostAttemptIdentity,
) {
  return (
    attempt?.sessionId === identity.sessionId &&
    attempt.resumeId === identity.resumeId &&
    attempt.userId === identity.userId
  )
}

export function isSamePendingGuestMembership(
  pending: PendingGuestMembership | null,
  identity: Pick<
    PendingGuestMembership,
    'generation' | 'sessionId' | 'resumeId' | 'memberLeaseId'
  >,
) {
  return (
    pending?.generation === identity.generation &&
    pending.sessionId === identity.sessionId &&
    pending.resumeId === identity.resumeId &&
    pending.memberLeaseId === identity.memberLeaseId
  )
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function assertPreparedSession(
  prepared: PreparedGuestSession,
  generation: number,
  get: () => CollaborationSessionStore,
) {
  const state = get()

  if (
    prepared.generation !== generation ||
    state.sessionId !== prepared.sessionId ||
    state.resumeId !== prepared.resumeId ||
    state.role !== 'guest'
  ) {
    throw new CollaborationOperationError('协作会话已切换', {
      code: 'session_changed',
    })
  }
}
