import {
  countCommentGraphemes,
  normalizeCommentText,
} from './resume-comment-core.ts'

export const COMMENT_API_OPS = [
  'register_collaboration_session',
  'join_collaboration_session',
  'renew_collaboration_session',
  'leave_collaboration_session',
  'create_anonymous_identity',
  'bootstrap_scope',
  'sync_working_document',
  'list_threads',
  'list_events',
  'create_thread',
  'create_reply',
  'edit_comment',
  'delete_comment',
  'delete_thread',
  'resolve_thread',
  'reopen_thread',
  'relink_anchor',
  'mark_read',
  'issue_realtime_token',
] as const

export type CommentApiOp = typeof COMMENT_API_OPS[number]

export const COMMENT_ERROR_CODES = [
  'unauthorized',
  'share_unavailable',
  'comments_disabled',
  'stale_release',
  'stale_document',
  'stale_revision',
  'invalid_selection',
  'anchor_detached',
  'rate_limited',
  'content_too_long',
  'not_found',
  'unexpected',
] as const

export type CommentErrorCode = typeof COMMENT_ERROR_CODES[number]

export interface CommentApiErrorBody {
  code: CommentErrorCode
  message: string
  retryAfterSeconds?: number
}

export type CommentApiResponse<T>
  = | { ok: true, data: T, eventSeq: number }
    | { ok: false, error: CommentApiErrorBody }

export interface CommentAnchorInput {
  nodeKey: string
  startGraphemeOffset: number
  endGraphemeOffset: number
  blockOrdinal: number
  exactQuote: string
  prefix: string
  suffix: string
  nodeTextHash: string
  createdAtContentHash: string
}

export class CommentApiError extends Error {
  readonly code: CommentErrorCode
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(
    code: CommentErrorCode,
    message: string,
    status = 400,
    retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'CommentApiError'
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function readCommentOp(value: unknown): CommentApiOp {
  if (!isRecord(value) || !COMMENT_API_OPS.includes(value.op as CommentApiOp)) {
    throw new CommentApiError('not_found', '未知的评论操作', 404)
  }
  return value.op as CommentApiOp
}

export function readRequiredString(
  value: unknown,
  field: string,
  maxLength = 512,
): string {
  if (!isRecord(value) || typeof value[field] !== 'string') {
    throw new CommentApiError('not_found', `缺少字段 ${field}`)
  }
  const result = value[field].trim()
  if (!result || result.length > maxLength) {
    throw new CommentApiError('not_found', `字段 ${field} 无效`)
  }
  return result
}

export function readOptionalString(
  value: unknown,
  field: string,
  maxLength = 512,
): string | null {
  if (!isRecord(value) || value[field] === undefined || value[field] === null) {
    return null
  }
  if (typeof value[field] !== 'string' || value[field].length > maxLength) {
    throw new CommentApiError('not_found', `字段 ${field} 无效`)
  }
  return value[field]
}

export function readUuid(value: unknown, field: string): string {
  const result = readRequiredString(value, field, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result)) {
    throw new CommentApiError('not_found', `字段 ${field} 无效`)
  }
  return result
}

export function readNonNegativeInteger(
  value: unknown,
  field: string,
  fallback?: number,
): number {
  if (!isRecord(value) || value[field] === undefined) {
    if (fallback !== undefined)
      return fallback
    throw new CommentApiError('not_found', `缺少字段 ${field}`)
  }
  const result = value[field]
  if (!Number.isInteger(result) || Number(result) < 0) {
    throw new CommentApiError('not_found', `字段 ${field} 无效`)
  }
  return Number(result)
}

export function readRequestId(value: unknown): string {
  return readUuid(value, 'requestId')
}

export function normalizeCommentBody(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CommentApiError('not_found', '评论正文不能为空')
  }
  const body = normalizeCommentText(value).trim()
  if (!body) {
    throw new CommentApiError('not_found', '评论正文不能为空')
  }
  if (/[^\t\n\r\P{Cc}]/u.test(body)) {
    throw new CommentApiError('not_found', '评论正文包含不支持的控制字符')
  }
  if (countCommentGraphemes(body) > 2_000) {
    throw new CommentApiError('content_too_long', '评论正文最多 2,000 个字符')
  }
  return body
}

export function readCommentAnchor(value: unknown): CommentAnchorInput {
  if (!isRecord(value)) {
    throw new CommentApiError('invalid_selection', '评论选区无效')
  }
  const nodeKey = readRequiredString(value, 'nodeKey', 512)
  const startGraphemeOffset = readNonNegativeInteger(value, 'startGraphemeOffset')
  const endGraphemeOffset = readNonNegativeInteger(value, 'endGraphemeOffset')
  const blockOrdinal = readNonNegativeInteger(value, 'blockOrdinal')
  const exactQuote = normalizeCommentText(readRequiredString(value, 'exactQuote', 8_000))
  const prefix = normalizeCommentText(readOptionalString(value, 'prefix', 1_000) ?? '')
  const suffix = normalizeCommentText(readOptionalString(value, 'suffix', 1_000) ?? '')
  const nodeTextHash = readRequiredString(value, 'nodeTextHash', 64)
  const createdAtContentHash = readRequiredString(value, 'createdAtContentHash', 64)
  if (
    startGraphemeOffset >= endGraphemeOffset
    || countCommentGraphemes(exactQuote) !== endGraphemeOffset - startGraphemeOffset
    || countCommentGraphemes(prefix) > 32
    || countCommentGraphemes(suffix) > 32
    || !/^[0-9a-f]{64}$/u.test(nodeTextHash)
    || !/^[0-9a-f]{64}$/u.test(createdAtContentHash)
  ) {
    throw new CommentApiError('invalid_selection', '评论选区无效')
  }
  return {
    nodeKey,
    startGraphemeOffset,
    endGraphemeOffset,
    blockOrdinal,
    exactQuote,
    prefix,
    suffix,
    nodeTextHash,
    createdAtContentHash,
  }
}

export function isSafeCommentLink(value: string): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  }
  catch {
    return false
  }
}
