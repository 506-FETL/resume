import type { CommentErrorCode } from '../../types.ts'

export class ResumeCommentClientError extends Error {
  readonly code: CommentErrorCode
  readonly retryAfterSeconds?: number
  readonly requestId?: string
  readonly details?: unknown

  constructor(
    code: CommentErrorCode,
    message: string,
    retryAfterSeconds?: number,
    requestId?: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ResumeCommentClientError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
    this.requestId = requestId
    this.details = details
  }
}

export function isResumeCommentClientError(
  error: unknown,
): error is ResumeCommentClientError {
  return error instanceof ResumeCommentClientError
}
