import {
  readRequiredString,
  CommentApiError,
} from '../shared/resume-comment-schema.ts'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export const COLLABORATION_SESSION_PATTERN = /^[\w-]{16,64}$/u

export function readCollaborationSessionId(body: Record<string, unknown>) {
  const sessionId = readRequiredString(body, 'sessionId', 64)

  if (!/^[\w-]{16,64}$/u.test(sessionId)) {
    throw new CommentApiError('not_found', '协作会话标识无效', 400)
  }

  return sessionId
}

export function isFutureTimestamp(value: string) {
  return Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now()
}

export function isUuidValue(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false

  const parsed = new Date(`${value}T00:00:00Z`)

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}
