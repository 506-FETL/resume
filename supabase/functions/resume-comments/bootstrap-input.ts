import type { BootstrapInputContext } from './bootstrap-types.ts'
import {
  readRequiredString,
  CommentApiError,
  readUuid,
  readNonNegativeInteger,
  isRecord,
} from '../shared/resume-comment-schema.ts'
import {
  invalidBootstrapCredential,
  validateCollaboratorTokenClaims,
  validateShareTokenClaims,
} from './bootstrap-credentials.ts'
import { isPositiveSafeInteger } from './validation.ts'
import {
  verifyCommentToken,
  hashAnonymousSecret,
} from '../shared/resume-comment-auth.ts'

export async function buildBootstrapInput({
  userId,
  body,
  tokenSecret,
  collaboratorSecret,
  anonymousPepper,
}: {
  userId: string | null
  body: Record<string, unknown>
  tokenSecret: string
  collaboratorSecret: string
  anonymousPepper: string
}): Promise<BootstrapInputContext> {
  const accessKind = readRequiredString(body, 'accessKind', 32)

  if (accessKind === 'owner') {
    if (!userId) return invalidBootstrapCredential('请先登录')
    if (
      body.historyVersionId !== undefined ||
      body.shareReleaseId !== undefined
    ) {
      throw new CommentApiError('not_found', '评论访问参数无效', 400)
    }

    const locatorKeys = ['scopeId', 'resumeId', 'versionId'].filter(
      (key) => body[key] !== undefined,
    )

    if (locatorKeys.length !== 1) {
      throw new CommentApiError('not_found', '评论访问参数无效', 400)
    }

    let scopeId: string | null = null
    let resumeId: string | null = null
    let versionId: number | null = null

    if (locatorKeys[0] === 'scopeId') {
      scopeId = readUuid(body, 'scopeId')
    } else if (locatorKeys[0] === 'resumeId') {
      resumeId = readUuid(body, 'resumeId')
    } else {
      const requestedVersionId = readNonNegativeInteger(body, 'versionId')

      if (!isPositiveSafeInteger(requestedVersionId))
        throw new CommentApiError('not_found', '简历版本不存在', 404)

      versionId = requestedVersionId
    }

    return {
      shareTokenSecret: null,
      collaboratorLease: null,
      rpcInput: {
        p_protocol_version: 1,
        p_access_kind: 'owner',
        p_user_id: userId,
        p_scope_id: scopeId,
        p_resume_id: resumeId,
        p_version_id: versionId,
        p_share_id: null,
        p_release_id: null,
        p_password_generation: null,
        p_session_id: null,
        p_collaborator_role: null,
        p_anonymous_id: null,
        p_anonymous_secret_hash: null,
      },
    }
  }

  if (accessKind === 'collaborator') {
    if (!userId) return invalidBootstrapCredential('请先登录')

    const verifiedToken = await verifyCommentToken(
      readRequiredString(body, 'accessToken', 4_096),
      'collaborator',
      collaboratorSecret,
    )

    const token = validateCollaboratorTokenClaims(verifiedToken, userId)

    return {
      shareTokenSecret: null,
      collaboratorLease: {
        protocolVersion: token.protocolVersion,
        sessionId: token.sessionId,
        resumeId: token.resumeId,
        userId: token.userId,
        memberLeaseId: token.memberLeaseId,
      },
      rpcInput: {
        p_protocol_version: 1,
        p_access_kind: 'collaborator',
        p_user_id: userId,
        p_scope_id: token.scopeId,
        p_resume_id: token.resumeId,
        p_version_id: token.versionId,
        p_share_id: null,
        p_release_id: null,
        p_password_generation: null,
        p_session_id: token.sessionId,
        p_collaborator_role: token.role,
        p_anonymous_id: null,
        p_anonymous_secret_hash: null,
      },
    }
  }

  if (accessKind !== 'share')
    return invalidBootstrapCredential('评论访问方式无效')

  const verifiedToken = await verifyCommentToken(
    readRequiredString(body, 'accessToken', 4_096),
    'share',
    tokenSecret,
  )

  const token = validateShareTokenClaims(verifiedToken)
  let anonymousId: string | null = null
  let anonymousSecretHash: string | null = null

  if (isRecord(body.anonymous)) {
    try {
      anonymousId = readUuid(body.anonymous, 'id')

      const anonymousSecret = readRequiredString(body.anonymous, 'secret', 128)

      anonymousSecretHash = await hashAnonymousSecret(
        anonymousSecret,
        anonymousPepper,
      )
    } catch {
      if (!userId) return invalidBootstrapCredential('匿名评论凭证无效')

      anonymousId = null
      anonymousSecretHash = null
    }
  }

  return {
    shareTokenSecret: tokenSecret,
    collaboratorLease: null,
    rpcInput: {
      p_protocol_version: 1,
      p_access_kind: 'share',
      p_user_id: userId,
      p_scope_id: token.scopeId,
      p_resume_id: null,
      p_version_id: token.versionId,
      p_share_id: token.shareId,
      p_release_id: token.releaseId,
      p_password_generation: token.passwordGeneration,
      p_session_id: null,
      p_collaborator_role: null,
      p_anonymous_id: anonymousId,
      p_anonymous_secret_hash: anonymousSecretHash,
    },
  }
}
