import type {
  AdminClient,
  ResolvedAccess,
  ScopeRow,
  CollaborationSessionRow,
  CollaborationMemberRow,
  ShareRow,
} from './types.ts'
import {
  readRequiredString,
  CommentApiError,
  readUuid,
  readNonNegativeInteger,
  isRecord,
} from '../shared/resume-comment-schema.ts'
import {
  getScope,
  ensureVersionScopeForOwner,
  resolveCurrentVersionId,
} from './scope-repository.ts'
import {
  verifyCommentToken,
  derivePasswordGeneration,
} from '../shared/resume-comment-auth.ts'
import { validateCollaboratorTokenClaims } from './bootstrap-credentials.ts'
import { isFutureTimestamp } from './validation.ts'
import { resolveAnonymousIdentity } from './anonymous-identity.ts'

// 旧访问解析器保留为 RPC 快速回滚路径。
// eslint-disable-next-line unused-imports/no-unused-vars
async function resolveAccess({
  userId,
  body,
  admin,
  tokenSecret,
  collaboratorSecret,
  anonymousPepper,
}: {
  userId: string | null
  body: Record<string, unknown>
  admin: AdminClient
  tokenSecret: string
  collaboratorSecret: string
  anonymousPepper: string
}): Promise<ResolvedAccess> {
  const accessKind = readRequiredString(body, 'accessKind', 32)

  if (accessKind === 'owner') {
    if (!userId) {
      throw new CommentApiError('unauthorized', '请先登录', 401)
    }

    let scope: ScopeRow

    if (typeof body.scopeId === 'string') {
      scope = await getScope(admin, readUuid(body, 'scopeId'))
    } else if (
      body.versionId !== undefined ||
      body.historyVersionId !== undefined
    ) {
      const versionId = readNonNegativeInteger(
        body,
        body.versionId !== undefined ? 'versionId' : 'historyVersionId',
      )

      if (versionId <= 0)
        throw new CommentApiError('not_found', '简历版本不存在', 404)

      scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    } else if (typeof body.shareReleaseId === 'string') {
      const shareReleaseId = readUuid(body, 'shareReleaseId')

      const { data: release, error: releaseError } = await admin
        .from('resume_share_releases')
        .select('id,share_id')
        .eq('id', shareReleaseId)
        .maybeSingle()

      if (releaseError || !release) {
        throw new CommentApiError('not_found', '分享反馈不存在', 404)
      }

      const { data: share, error: shareError } = await admin
        .from('resume_shares')
        .select('id,user_id,version_id')
        .eq('id', release.share_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (shareError || !share) {
        throw new CommentApiError('not_found', '分享反馈不存在', 404)
      }

      const versionId = Number(share.version_id)

      if (!Number.isSafeInteger(versionId) || versionId <= 0)
        throw new CommentApiError('not_found', '分享版本不存在', 404)

      scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    } else {
      const resumeId = readUuid(body, 'resumeId')
      const versionId = await resolveCurrentVersionId(admin, userId, resumeId)

      scope = await ensureVersionScopeForOwner(admin, userId, versionId)
    }
    if (
      scope.owner_user_id !== userId ||
      scope.kind !== 'version' ||
      scope.version_id == null
    ) {
      throw new CommentApiError('not_found', '评论空间不存在', 404)
    }

    return {
      kind: 'owner',
      scope,
      userId,
      actorKind: 'user',
      actorId: userId,
      actorKey: `user:${userId}`,
      legacyAnonymousId: null,
      share: null,
      releaseId: null,
      versionId: scope.version_id,
      canWrite: true,
      canManageAll: true,
    }
  }

  if (accessKind === 'collaborator') {
    if (!userId) {
      throw new CommentApiError('unauthorized', '请先登录', 401)
    }

    const verifiedToken = await verifyCommentToken(
      readRequiredString(body, 'accessToken', 4_096),
      'collaborator',
      collaboratorSecret,
    )

    const token = validateCollaboratorTokenClaims(verifiedToken, userId)

    let memberQuery = admin
      .from('resume_comment_collaboration_members')
      .select(
        'session_id,user_id,member_lease_id,protocol_version,role,expires_at,revoked_at',
      )
      .eq('session_id', token.sessionId)
      .eq('user_id', userId)
      .eq('protocol_version', token.protocolVersion)

    if (token.protocolVersion === 2) {
      memberQuery = memberQuery.eq('member_lease_id', token.memberLeaseId)
    }

    const [scope, sessionResult, memberResult] = await Promise.all([
      getScope(admin, token.scopeId),
      admin
        .from('resume_comment_collaboration_sessions')
        .select(
          'session_id,resume_id,scope_id,owner_user_id,host_lease_id,default_role,expires_at,revoked_at,protocol_version',
        )
        .eq('session_id', token.sessionId)
        .eq('protocol_version', token.protocolVersion)
        .maybeSingle(),
      memberQuery.maybeSingle(),
    ])

    const session = sessionResult.data as CollaborationSessionRow | null
    const member = memberResult.data as CollaborationMemberRow | null

    if (
      sessionResult.error ||
      memberResult.error ||
      !session ||
      !member ||
      token.userId !== userId ||
      token.sessionId !== session.session_id ||
      token.resumeId !== session.resume_id ||
      token.scopeId !== session.scope_id ||
      token.versionId !== scope.version_id ||
      token.role !== member.role ||
      token.protocolVersion !== session.protocol_version ||
      token.protocolVersion !== member.protocol_version ||
      (token.protocolVersion === 2 &&
        token.memberLeaseId !== member.member_lease_id) ||
      member.user_id !== userId ||
      member.revoked_at ||
      session.revoked_at ||
      !isFutureTimestamp(member.expires_at) ||
      !isFutureTimestamp(session.expires_at) ||
      scope.kind !== 'version' ||
      scope.version_id == null ||
      scope.resume_id !== token.resumeId ||
      scope.owner_user_id !== session.owner_user_id
    ) {
      throw new CommentApiError('unauthorized', '协作评论凭证无效', 401)
    }

    return {
      kind: 'collaborator',
      scope,
      userId,
      actorKind: 'user',
      actorId: userId,
      actorKey: `user:${userId}`,
      legacyAnonymousId: null,
      share: null,
      releaseId: null,
      versionId: scope.version_id,
      canWrite: token.role === 'editor',
      canManageAll: false,
    }
  }

  if (accessKind !== 'share') {
    throw new CommentApiError('unauthorized', '评论访问方式无效', 401)
  }

  const token = await verifyCommentToken(
    readRequiredString(body, 'accessToken', 4_096),
    'share',
    tokenSecret,
  )

  const [scope, shareResult] = await Promise.all([
    getScope(admin, token.scopeId),
    admin
      .from('resume_shares')
      .select(
        'id,user_id,version_id,current_release_id,allow_comments,is_active,archived_at,expires_at,password_hash',
      )
      .eq('id', token.shareId)
      .maybeSingle(),
  ])

  const share = shareResult.data as ShareRow | null

  if (
    shareResult.error ||
    !share ||
    !share.is_active ||
    share.archived_at ||
    (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())
  ) {
    throw new CommentApiError('share_unavailable', '分享已不可用', 404)
  }
  if (
    share.version_id !== token.versionId ||
    scope.version_id !== token.versionId ||
    scope.kind !== 'version' ||
    scope.archived_at ||
    share.current_release_id !== token.releaseId
  ) {
    throw new CommentApiError(
      'stale_release',
      '分享版本已变化，请刷新后重试',
      409,
    )
  }

  const passwordGeneration = await derivePasswordGeneration(
    share.password_hash,
    tokenSecret,
  )

  if (passwordGeneration !== token.passwordGeneration) {
    throw new CommentApiError(
      'share_unavailable',
      '分享访问状态已变化，请重新验证',
      401,
    )
  }

  let anonymousId: string | null = null

  try {
    anonymousId = await resolveAnonymousIdentity({
      admin,
      body,
      versionId: token.versionId,
      pepper: anonymousPepper,
      required: !userId && isRecord(body.anonymous),
    })
  } catch (error) {
    if (!userId) {
      throw error
    }
  }

  return {
    kind: 'share',
    scope,
    userId,
    actorKind: userId ? 'user' : anonymousId ? 'anonymous' : null,
    actorId: userId ?? anonymousId,
    actorKey: userId
      ? `user:${userId}`
      : anonymousId
        ? `anonymous:${anonymousId}`
        : null,
    legacyAnonymousId: userId ? anonymousId : null,
    share,
    releaseId: token.releaseId,
    versionId: token.versionId,
    canWrite: share.allow_comments,
    canManageAll: false,
  }
}
