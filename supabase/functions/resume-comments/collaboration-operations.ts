import type { AdminClient, CollaborationMemberRow } from './types.ts'
import {
  CommentApiError,
  readUuid,
  isRecord,
} from '../shared/resume-comment-schema.ts'
import { readCollaborationSessionId, isUuidValue } from './validation.ts'
import {
  readCollaborationProtocolVersion,
  readSupportedCollaborationProtocolVersions,
  negotiateCollaborationProtocolVersion,
  allowNewLegacyCollaborationSession,
  throwCollaborationRpcError,
  readClaimedMember,
} from './collaboration-protocol.ts'
import {
  resolveCurrentVersionId,
  ensureVersionScopeForOwner,
} from './scope-repository.ts'
import {
  getCollaborationSession,
  getActiveCollaborationSession,
  issueCollaboratorToken,
  loadCollaborationDocumentBootstrap,
} from './collaboration-repository.ts'

export async function handleCollaborationSessionOperation({
  op,
  userId,
  body,
  admin,
  collaboratorSecret,
}: {
  op:
    | 'register_collaboration_session'
    | 'join_collaboration_session'
    | 'renew_collaboration_session'
    | 'leave_collaboration_session'
  userId: string | null
  body: Record<string, unknown>
  admin: AdminClient
  collaboratorSecret: string
}) {
  if (!userId) {
    throw new CommentApiError('unauthorized', '请先登录', 401)
  }

  const sessionId = readCollaborationSessionId(body)
  const resumeId = readUuid(body, 'resumeId')
  const requestedProtocolVersion = readCollaborationProtocolVersion(body)

  const supportedProtocolVersions =
    readSupportedCollaborationProtocolVersions(body)

  if (op === 'register_collaboration_session') {
    const versionId = await resolveCurrentVersionId(admin, userId, resumeId)
    const scope = await ensureVersionScopeForOwner(admin, userId, versionId)

    const existingSession = await getCollaborationSession(
      admin,
      sessionId,
      resumeId,
    )

    const protocolVersion = existingSession
      ? negotiateCollaborationProtocolVersion(
          requestedProtocolVersion,
          supportedProtocolVersions,
          existingSession.protocol_version,
        )
      : requestedProtocolVersion

    const allowNewLegacySession =
      supportedProtocolVersions.size > 0 || allowNewLegacyCollaborationSession()

    const requestedExpiresAt = new Date(
      Date.now() + 8 * 60 * 60 * 1_000,
    ).toISOString()

    const { data, error } = await admin.rpc(
      'claim_resume_comment_collaboration_session_v2',
      {
        p_session_id: sessionId,
        p_resume_id: resumeId,
        p_scope_id: scope.id,
        p_owner_user_id: userId,
        p_default_role: 'editor',
        p_expires_at: requestedExpiresAt,
        p_protocol_version: protocolVersion,
        p_allow_new_legacy_session: allowNewLegacySession,
      },
    )

    if (error) return throwCollaborationRpcError(error)
    if (
      !isRecord(data) ||
      data.sessionId !== sessionId ||
      data.resumeId !== resumeId ||
      data.protocolVersion !== protocolVersion ||
      !isUuidValue(data.hostLeaseId) ||
      typeof data.expiresAt !== 'string'
    ) {
      throw new Error('Invalid collaboration session claim response')
    }

    return {
      sessionId,
      resumeId,
      expiresAt: data.expiresAt,
      hostLeaseId: data.hostLeaseId,
      protocolVersion,
    }
  }

  if (op === 'leave_collaboration_session') {
    const session = await getCollaborationSession(admin, sessionId, resumeId)

    if (!session) {
      return {
        sessionId,
        revoked: false,
        protocolVersion: requestedProtocolVersion,
      }
    }

    const protocolVersion = negotiateCollaborationProtocolVersion(
      requestedProtocolVersion,
      supportedProtocolVersions,
      session.protocol_version,
    )

    if (session.owner_user_id === userId) {
      const hostLeaseId = readUuid(body, 'hostLeaseId')

      const { data, error } = await admin.rpc(
        'revoke_resume_comment_collaboration_session_v2',
        {
          p_session_id: sessionId,
          p_resume_id: resumeId,
          p_owner_user_id: userId,
          p_host_lease_id: hostLeaseId,
          p_protocol_version: protocolVersion,
        },
      )

      if (error) return throwCollaborationRpcError(error)

      return { sessionId, revoked: data === true, protocolVersion }
    }

    const memberLeaseId =
      protocolVersion === 2 ? readUuid(body, 'memberLeaseId') : null

    const { data, error } = await admin.rpc(
      'release_resume_comment_collaboration_member_v2',
      {
        p_session_id: sessionId,
        p_resume_id: resumeId,
        p_user_id: userId,
        p_member_lease_id: memberLeaseId,
        p_protocol_version: protocolVersion,
      },
    )

    if (error) return throwCollaborationRpcError(error)

    return { sessionId, revoked: data === true, protocolVersion }
  }

  const session = await getActiveCollaborationSession(
    admin,
    sessionId,
    resumeId,
  )

  if (op === 'join_collaboration_session' && session.owner_user_id === userId) {
    throw new CommentApiError(
      'owner_must_host',
      '简历所有者应恢复为协作发起者',
      409,
    )
  }

  const protocolVersion = negotiateCollaborationProtocolVersion(
    requestedProtocolVersion,
    supportedProtocolVersions,
    session.protocol_version,
  )

  let member: CollaborationMemberRow

  if (op === 'join_collaboration_session') {
    const memberLeaseId =
      protocolVersion === 2 ? readUuid(body, 'memberLeaseId') : null

    const { data, error } = await admin.rpc(
      'claim_resume_comment_collaboration_member_v2',
      {
        p_session_id: sessionId,
        p_resume_id: resumeId,
        p_user_id: userId,
        p_member_lease_id: memberLeaseId,
        p_protocol_version: protocolVersion,
      },
    )

    if (error) return throwCollaborationRpcError(error)

    member = readClaimedMember(data)
  } else {
    const memberLeaseId =
      protocolVersion === 2 ? readUuid(body, 'memberLeaseId') : null

    if (protocolVersion === 2) {
      const { data, error } = await admin.rpc(
        'renew_resume_comment_collaboration_member_v2',
        {
          p_session_id: sessionId,
          p_resume_id: resumeId,
          p_user_id: userId,
          p_member_lease_id: memberLeaseId,
          p_protocol_version: protocolVersion,
        },
      )

      if (error) return throwCollaborationRpcError(error)

      member = readClaimedMember(data)
    } else {
      const { data, error } = await admin
        .from('resume_comment_collaboration_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('protocol_version', 1)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .select(
          'session_id,user_id,member_lease_id,protocol_version,role,expires_at,revoked_at',
        )
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new CommentApiError('unauthorized', '协作者评论权限已失效', 401)
      }

      member = data as CollaborationMemberRow
    }
  }

  if (
    member.protocol_version !== protocolVersion ||
    member.session_id !== sessionId ||
    member.user_id !== userId
  ) {
    throw new CommentApiError('unauthorized', '协作者评论权限不存在', 401)
  }

  const { data: scope, error: scopeError } = await admin
    .from('resume_comment_scopes')
    .select('kind,version_id')
    .eq('id', session.scope_id)
    .maybeSingle()

  if (scopeError || !scope)
    throw new CommentApiError('not_found', '评论空间不存在', 404)

  if (scope.kind !== 'version' || scope.version_id == null)
    throw new CommentApiError('unauthorized', '协作评论版本无效', 401)

  const commentAccess = await issueCollaboratorToken({
    session,
    member,
    versionId: scope.version_id,
    collaboratorSecret,
  })

  if (op === 'renew_collaboration_session') {
    return commentAccess
  }

  const bootstrap = await loadCollaborationDocumentBootstrap(admin, session)

  return { ...commentAccess, bootstrap }
}
