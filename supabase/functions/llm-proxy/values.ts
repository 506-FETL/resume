export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function readSqlState(error: unknown) {
  return isRecord(error) &&
    typeof error.code === 'string' &&
    /^[0-9A-Z]{5}$/u.test(error.code)
    ? error.code
    : undefined
}
