/**
 * Extract a human-readable message from an unknown error value.
 * Safe replacement for `(err: any).message` patterns when narrowing
 * `catch (err: unknown)` blocks.
 */
export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后再试'): string {
  if (!error)
    return fallback

  if (typeof error === 'string')
    return error || fallback

  if (error instanceof Error)
    return error.message || fallback

  if (typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.length > 0)
      return msg
  }

  return fallback
}
