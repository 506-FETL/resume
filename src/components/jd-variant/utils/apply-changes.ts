import type { PersistedResumeSnapshot, VariantChange } from '@/lib/schema'

function setNested(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')

  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value }
  }

  const [head, ...rest] = keys
  const next = (obj[head] as Record<string, unknown>) ?? {}

  return { ...obj, [head]: setNested(next, rest.join('.'), value) }
}

function applyToValue(fieldPath: string, after: string): string | string[] {
  if (fieldPath === 'bullets') {
    return after.split('\n').filter(Boolean)
  }

  return after
}

export function applyVariantChange<T extends PersistedResumeSnapshot | Partial<PersistedResumeSnapshot>>(
  snapshot: T,
  change: VariantChange,
): T {
  const sectionKey = change.section
  const current = (snapshot as Record<string, unknown>)[sectionKey]

  if (change.itemId === 'whole') {
    const valueToSet = applyToValue(change.fieldPath, change.after)
    const nextValue = current && typeof current === 'object' && !Array.isArray(current)
      ? setNested(current as Record<string, unknown>, change.fieldPath, valueToSet)
      : { [change.fieldPath]: valueToSet }

    return { ...(snapshot as Record<string, unknown>), [sectionKey]: nextValue } as T
  }

  if (Array.isArray(current)) {
    const arr = current as Array<Record<string, unknown> & { id?: string }>
    const found = arr.some(i => i?.id === change.itemId)

    if (!found) {
      return snapshot
    }

    const nextArr = arr.map((item) => {
      if (item?.id !== change.itemId) {
        return item
      }
      return setNested(item, change.fieldPath, applyToValue(change.fieldPath, change.after))
    })

    return { ...(snapshot as Record<string, unknown>), [sectionKey]: nextArr } as T
  }

  return snapshot
}
