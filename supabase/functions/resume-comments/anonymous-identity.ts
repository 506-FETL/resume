import type { AdminClient, ResolvedAccess } from './types.ts'
import {
  isRecord,
  CommentApiError,
  readUuid,
  readRequiredString,
  readRequestId,
} from '../shared/resume-comment-schema.ts'
import {
  hashAnonymousSecret,
  timingSafeStringEqual,
} from '../shared/resume-comment-auth.ts'
import { readReplay, enforceRateLimit } from './write-access.ts'

export async function resolveAnonymousIdentity({
  admin,
  body,
  versionId,
  pepper,
  required,
}: {
  admin: AdminClient
  body: Record<string, unknown>
  versionId: number
  pepper: string
  required: boolean
}): Promise<string | null> {
  const anonymous = body.anonymous

  if (!isRecord(anonymous)) {
    if (required) {
      throw new CommentApiError('unauthorized', '请先创建匿名评论身份', 401)
    }

    return null
  }

  const anonymousId = readUuid(anonymous, 'id')
  const secret = readRequiredString(anonymous, 'secret', 128)
  const expectedHash = await hashAnonymousSecret(secret, pepper)

  const { data, error } = await admin
    .from('resume_comment_anonymous_identities')
    .select('id,version_id,secret_hash,revoked_at')
    .eq('id', anonymousId)
    .maybeSingle()

  if (
    error ||
    !data ||
    Number(data.version_id) !== versionId ||
    data.revoked_at ||
    !timingSafeStringEqual(expectedHash, data.secret_hash)
  ) {
    if (required) {
      throw new CommentApiError('unauthorized', '匿名评论凭证无效', 401)
    }

    return null
  }

  await admin
    .from('resume_comment_anonymous_identities')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', anonymousId)

  return anonymousId
}

export async function createAnonymousCommentIdentity({
  req,
  admin,
  body,
  access,
  anonymousPepper,
  success,
}: {
  req: Request
  admin: AdminClient
  body: Record<string, unknown>
  access: ResolvedAccess
  anonymousPepper: string
  success: (data: unknown, eventSeq: number) => Response
}): Promise<Response> {
  if (access.kind !== 'share' || access.userId) {
    throw new CommentApiError('unauthorized', '当前登录身份不使用匿名评论', 403)
  }
  if (!access.canWrite) {
    throw new CommentApiError('comments_disabled', '当前分享已关闭评论', 403)
  }

  const requestId = readRequestId(body)
  const secret = readRequiredString(body, 'anonymousSecret', 128)
  const secretHash = await hashAnonymousSecret(secret, anonymousPepper)
  const actorKey = `anonymous-new:${secretHash}`
  const replay = await readReplay(admin, actorKey, requestId)

  if (replay) {
    return success(
      replay,
      Number(replay.eventSeq ?? access.scope.next_event_seq),
    )
  }

  const networkAccess: ResolvedAccess = {
    ...access,
    actorKind: 'anonymous',
    actorId: crypto.randomUUID(),
    actorKey,
  }

  await enforceRateLimit({
    req,
    admin,
    access: networkAccess,
    threadId: null,
    pepper: anonymousPepper,
  })

  const { data, error } = await admin.rpc(
    'create_resume_comment_anonymous_identity_v2',
    {
      p_share_id: access.share!.id,
      p_version_id: access.versionId,
      p_scope_id: access.scope.id,
      p_secret_hash: secretHash,
      p_actor_key: actorKey,
      p_request_id: requestId,
    },
  )

  if (error) {
    throw error
  }

  return success(data, Number(data.eventSeq))
}
