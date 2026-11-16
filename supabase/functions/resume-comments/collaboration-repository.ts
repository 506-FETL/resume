import type {
  AdminClient,
  CollaborationSessionRow,
  CollaborationDocumentRow,
  CollaborationMemberRow,
} from './types.ts'
import { isFutureTimestamp } from './validation.ts'
import { CommentApiError } from '../shared/resume-comment-schema.ts'
import { signCommentToken } from '../shared/resume-comment-auth.ts'

export async function getActiveCollaborationSession(
  admin: AdminClient,
  sessionId: string,
  resumeId: string,
) {
  const session = await getCollaborationSession(admin, sessionId, resumeId)

  if (
    !session ||
    session.revoked_at ||
    !isFutureTimestamp(session.expires_at)
  ) {
    throw new CommentApiError('unauthorized', '协作会话已结束或不存在', 401)
  }

  return session
}

export async function getCollaborationSession(
  admin: AdminClient,
  sessionId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_comment_collaboration_sessions')
    .select(
      'session_id,resume_id,scope_id,owner_user_id,host_lease_id,default_role,expires_at,revoked_at,protocol_version',
    )
    .eq('session_id', sessionId)
    .eq('resume_id', resumeId)
    .maybeSingle()

  if (error) throw error

  return data as CollaborationSessionRow | null
}

export async function loadCollaborationDocumentBootstrap(
  admin: AdminClient,
  session: CollaborationSessionRow,
) {
  const { data, error } = await admin
    .from('automerge_documents')
    .select('document_data,heads,document_version,updated_at')
    .eq('resume_id', session.resume_id)
    .eq('user_id', session.owner_user_id)
    .maybeSingle()

  if (error) {
    throw error
  }

  const row = data as CollaborationDocumentRow | null

  if (
    !row ||
    typeof row.document_data !== 'string' ||
    row.document_data.length === 0
  ) {
    throw new CommentApiError(
      'collaboration_snapshot_unavailable',
      '共享简历快照暂时不可用',
      409,
    )
  }

  return {
    documentData: row.document_data,
    heads: Array.isArray(row.heads) ? row.heads : [],
    documentVersion: Number.isFinite(row.document_version)
      ? row.document_version
      : 1,
    updatedAt: row.updated_at,
  }
}

export async function issueCollaboratorToken({
  session,
  member,
  versionId,
  collaboratorSecret,
}: {
  session: CollaborationSessionRow
  member: CollaborationMemberRow
  versionId: number
  collaboratorSecret: string
}) {
  const issuedAt = Math.floor(Date.now() / 1_000)
  const sessionExpiresAt = Math.floor(Date.parse(session.expires_at) / 1_000)
  const memberExpiresAt = Math.floor(Date.parse(member.expires_at) / 1_000)

  const expiresAt = Math.min(
    issuedAt + 15 * 60,
    sessionExpiresAt,
    memberExpiresAt,
  )

  if (expiresAt <= issuedAt) {
    throw new CommentApiError('unauthorized', '协作会话已失效', 401)
  }

  return {
    accessToken: await signCommentToken(
      {
        version: 1,
        kind: 'collaborator',
        issuedAt,
        expiresAt,
        sessionId: session.session_id,
        resumeId: session.resume_id,
        scopeId: session.scope_id,
        versionId,
        userId: member.user_id,
        role: member.role,
        protocolVersion: session.protocol_version,
        ...(session.protocol_version === 2
          ? { memberLeaseId: member.member_lease_id }
          : {}),
      },
      collaboratorSecret,
    ),
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
    sessionId: session.session_id,
    resumeId: session.resume_id,
    versionId,
    userId: member.user_id,
    protocolVersion: session.protocol_version,
    ...(session.protocol_version === 2
      ? { memberLeaseId: member.member_lease_id }
      : {}),
    role: member.role,
  }
}
