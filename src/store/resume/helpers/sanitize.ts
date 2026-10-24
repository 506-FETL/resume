import { cloneDeepWith } from 'lodash'

export function sanitizeDeep<T>(value: T): T {
  return cloneDeepWith(value, (val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(
        Object.entries(val).filter(([, v]) => v !== undefined),
      )
    }
  }) as T
}

export function applyPatch(
  target: Record<string, any>,
  patch: Record<string, unknown>,
) {
  for (const [field, value] of Object.entries(patch)) {
    if (value !== undefined) {
      target[field] = value
    }
  }
}
