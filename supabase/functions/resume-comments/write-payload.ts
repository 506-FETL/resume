import { CommentApiError, isRecord } from '../shared/resume-comment-schema.ts'
import type { ResolvedAccess } from './types.ts'

export function mapDatabaseError(error: unknown): CommentApiError {
  if (error instanceof CommentApiError) {
    return error
  }
  if (isRecord(error) && error.code === '40P01') {
    return new CommentApiError(
      'database_deadlock',
      '请求发生并发冲突，请重试',
      409,
    )
  }

  const message =
    isRecord(error) && typeof error.message === 'string' ? error.message : ''

  // 真正的瞬时序列化失败（含 request_in_progress）保留 40001，交由客户端幂等重试。
  if (isRecord(error) && error.code === '40001') {
    return new CommentApiError(
      'database_deadlock',
      '请求发生并发冲突，请重试',
      409,
    )
  }

  const mappings: Array<[string, CommentApiError]> = [
    [
      'stale_release',
      new CommentApiError(
        'stale_release',
        '分享已发布新版本，请刷新后重试',
        409,
      ),
    ],
    [
      'stale_document',
      new CommentApiError(
        'stale_document',
        '简历内容已变化，请重新选择文字',
        409,
      ),
    ],
    [
      'stale_revision',
      new CommentApiError(
        'stale_revision',
        '评论已被其他人更新，请刷新后重试',
        409,
      ),
    ],
    [
      'invalid_selection',
      new CommentApiError('invalid_selection', '评论选区已失效', 400),
    ],
    [
      'unauthorized',
      new CommentApiError('unauthorized', '没有权限执行此操作', 403),
    ],
    ['not_found', new CommentApiError('not_found', '目标不存在', 404)],
  ]

  return (
    mappings.find(([needle]) => message.includes(needle))?.[1] ??
    new CommentApiError('unexpected', '评论服务暂时不可用', 500)
  )
}

export function writePayload(
  body: Record<string, unknown>,
  access: ResolvedAccess,
) {
  const payload: Record<string, unknown> = {
    manageAll: access.canManageAll,
    legacyAnonymousId: access.legacyAnonymousId,
  }

  const copy = (field: string) => {
    if (body[field] !== undefined) payload[field] = body[field]
  }

  ;[
    'threadId',
    'commentId',
    'parentCommentId',
    'expectedRevision',
    'documentHash',
    'originalPageIndex',
    'eventSeq',
  ].forEach(copy)

  return payload
}
