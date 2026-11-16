import { leaveCollaborationCommentSession } from '../service'
import type { CollaborationSessionStore } from '../types'
import { isSamePendingGuestMembership } from './guards'
import type {
  GuestMembershipIdentity,
  PendingGuestMembership,
  SessionRuntime,
} from './types'

export const clearPendingGuestMembership = (
  runtime: SessionRuntime,
  identity: Pick<
    PendingGuestMembership,
    'generation' | 'sessionId' | 'resumeId' | 'memberLeaseId'
  >,
) => {
  if (isSamePendingGuestMembership(runtime.pendingGuestMembership, identity)) {
    runtime.pendingGuestMembership = null

    return true
  }

  return false
}

export const getCurrentPendingGuestMembership = (
  runtime: SessionRuntime,
  generation: number,
  state: Pick<CollaborationSessionStore, 'sessionId' | 'resumeId' | 'role'>,
) => {
  const pending = runtime.pendingGuestMembership

  if (
    pending?.generation === generation &&
    pending.sessionId === state.sessionId &&
    pending.resumeId === state.resumeId &&
    state.role === 'guest'
  ) {
    return pending
  }

  return null
}

export const releaseGuestMembership = async (
  membership: GuestMembershipIdentity,
  options: { bestEffort: boolean },
) => {
  try {
    return await leaveCollaborationCommentSession({
      sessionId: membership.sessionId,
      resumeId: membership.resumeId,
      protocolVersion: membership.protocolVersion,
      memberLeaseId: membership.memberLeaseId,
    })
  } catch (error) {
    if (!options.bestEffort) {
      throw error
    }

    console.warn('[collaboration] failed to release guest membership:', error)

    return null
  }
}

export const retirePendingGuestMembership = (
  runtime: SessionRuntime,
  membership: PendingGuestMembership,
) => {
  // 先发起 leave，再按完整 identity 清理私有 pending；旧请求迟到时会
  // 使用闭包中的同 token 再次幂等 release，不能清掉新一代 identity。
  releaseGuestMembership(membership, { bestEffort: true }).catch(
    () => undefined,
  )

  clearPendingGuestMembership(runtime, membership)
}
