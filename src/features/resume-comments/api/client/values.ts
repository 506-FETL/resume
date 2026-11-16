import type { CommentAuthMode } from './types'

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isCommentAuthMode(value: unknown): value is CommentAuthMode {
  return (
    value === 'anonymous' || value === 'local_jwks' || value === 'legacy_auth'
  )
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asNumber(value: unknown, fallback = 0) {
  const result = Number(value)

  return Number.isFinite(result) ? result : fallback
}

export function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}
