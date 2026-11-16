import { CommentApiError, isRecord } from '../shared/resume-comment-schema.ts'
import {
  isUuidValue,
  COLLABORATION_SESSION_PATTERN,
  isPositiveSafeInteger,
  isFutureTimestamp,
} from './validation.ts'
import type {
  AdminClient,
  CollaborationSessionRow,
  CollaborationMemberRow,
} from './types.ts'
import type { BootstrapInputContext } from './bootstrap-types.ts'

export function invalidBootstrapCredential(
  message = '评论访问凭证无效',
): never {
  throw new CommentApiError('unauthorized', message, 401)
}

export function validateCollaboratorTokenClaims(
  value: unknown,
  userId: string,
): {
  protocolVersion: 1 | 2
  scopeId: string
  resumeId: string
  userId: string
  sessionId: string
  versionId: number
  memberLeaseId: string | null
  role: 'editor' | 'viewer'
} {
  const protocolVersion = isRecord(value) && value.protocolVersion === 2 ? 2 : 1

  if (
    !isRecord(value) ||
    value.kind !== 'collaborator' ||
    !isUuidValue(value.scopeId) ||
    !isUuidValue(value.resumeId) ||
    !isUuidValue(value.userId) ||
    value.userId !== userId ||
    typeof value.sessionId !== 'string' ||
    !COLLABORATION_SESSION_PATTERN.test(value.sessionId) ||
    !isPositiveSafeInteger(value.versionId) ||
    (value.role !== 'editor' && value.role !== 'viewer') ||
    (protocolVersion === 2 && !isUuidValue(value.memberLeaseId)) ||
    (protocolVersion === 1 &&
      value.protocolVersion !== undefined &&
      value.protocolVersion !== 1) ||
    (protocolVersion === 1 && value.memberLeaseId !== undefined)
  ) {
    return invalidBootstrapCredential('协作评论凭证无效')
  }

  return {
    protocolVersion,
    scopeId: value.scopeId,
    resumeId: value.resumeId,
    userId: value.userId,
    sessionId: value.sessionId,
    versionId: value.versionId,
    memberLeaseId:
      protocolVersion === 2 ? (value.memberLeaseId as string) : null,
    role: value.role === 'editor' ? 'editor' : 'viewer',
  }
}

export function validateShareTokenClaims(value: unknown) {
  if (
    !isRecord(value) ||
    value.kind !== 'share' ||
    !isUuidValue(value.shareId) ||
    !isUuidValue(value.releaseId) ||
    !isUuidValue(value.scopeId) ||
    !isPositiveSafeInteger(value.versionId) ||
    typeof value.passwordGeneration !== 'string' ||
    value.passwordGeneration.trim().length === 0
  ) {
    return invalidBootstrapCredential()
  }

  return {
    shareId: value.shareId,
    releaseId: value.releaseId,
    scopeId: value.scopeId,
    versionId: value.versionId,
    passwordGeneration: value.passwordGeneration,
  }
}

export async function assertCollaboratorBootstrapLease(
  admin: AdminClient,
  lease: BootstrapInputContext['collaboratorLease'],
) {
  if (!lease) return

  const [sessionResult, memberResult] = await Promise.all([
    admin
      .from('resume_comment_collaboration_sessions')
      .select('session_id,resume_id,protocol_version,expires_at,revoked_at')
      .eq('session_id', lease.sessionId)
      .eq('resume_id', lease.resumeId)
      .eq('protocol_version', lease.protocolVersion)
      .maybeSingle(),
    admin
      .from('resume_comment_collaboration_members')
      .select(
        'session_id,user_id,member_lease_id,protocol_version,expires_at,revoked_at',
      )
      .eq('session_id', lease.sessionId)
      .eq('user_id', lease.userId)
      .eq('protocol_version', lease.protocolVersion)
      .maybeSingle(),
  ])

  const session = sessionResult.data as Pick<
    CollaborationSessionRow,
    | 'session_id'
    | 'resume_id'
    | 'protocol_version'
    | 'expires_at'
    | 'revoked_at'
  > | null

  const member = memberResult.data as Pick<
    CollaborationMemberRow,
    | 'session_id'
    | 'user_id'
    | 'member_lease_id'
    | 'protocol_version'
    | 'expires_at'
    | 'revoked_at'
  > | null

  if (
    sessionResult.error ||
    memberResult.error ||
    !session ||
    !member ||
    session.revoked_at ||
    member.revoked_at ||
    !isFutureTimestamp(session.expires_at) ||
    !isFutureTimestamp(member.expires_at) ||
    (lease.protocolVersion === 2 &&
      member.member_lease_id !== lease.memberLeaseId)
  ) {
    throw new CommentApiError('unauthorized', '协作评论凭证已失效', 401)
  }
}
