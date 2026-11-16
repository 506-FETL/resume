import { CommentApiError, isRecord } from '../shared/resume-comment-schema.ts'

export class BootstrapInternalError extends Error {
  readonly category: string

  constructor(category: string) {
    super('resume comments bootstrap internal failure')
    this.name = 'BootstrapInternalError'
    this.category = category
  }
}

export function bootstrapProtocolError(category: string): never {
  throw new BootstrapInternalError(category)
}

export function mapBootstrapRpcError(error: unknown): CommentApiError {
  if (
    !isRecord(error) ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string'
  )
    return bootstrapProtocolError('unexpected_rpc_error')

  const mapping: Record<string, CommentApiError> = {
    '42501:unauthorized': new CommentApiError(
      'unauthorized',
      '没有权限访问评论',
      401,
    ),
    'P0002:not_found': new CommentApiError('not_found', '评论空间不存在', 404),
    'P0404:share_unavailable': new CommentApiError(
      'share_unavailable',
      '分享已不可用',
      404,
    ),
    'P0403:comments_disabled': new CommentApiError(
      'comments_disabled',
      '当前分享已关闭评论',
      403,
    ),
    'P0409:stale_release': new CommentApiError(
      'stale_release',
      '分享版本已变化，请刷新后重试',
      409,
    ),
  }

  return (
    mapping[`${error.code}:${error.message}`] ??
    bootstrapProtocolError('unexpected_rpc_error')
  )
}

export function mapBootstrapRepairError(error: unknown): CommentApiError {
  if (
    isRecord(error) &&
    error.code === 'P0409' &&
    error.message === 'stale_document'
  ) {
    return new CommentApiError(
      'stale_document',
      '简历内容已变化，请刷新后重试',
      409,
    )
  }

  return bootstrapProtocolError('scope_repair_failed')
}
