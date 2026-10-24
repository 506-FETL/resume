import type { PersistedResumeSnapshot, VariantChange } from '@/lib/schema'
import { getVariantFieldMapping } from '@/lib/schema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function applyVariantChange<
  T extends PersistedResumeSnapshot | Partial<PersistedResumeSnapshot>,
>(snapshot: T, change: VariantChange): T {
  const mapping = getVariantFieldMapping(change.section, change.fieldPath)

  if (!mapping || (!mapping.collection && change.itemId !== 'whole')) {
    throw new Error(`JD 改写路径无效：${change.section}.${change.fieldPath}`)
  }

  const current: unknown = snapshot[change.section]

  if (!isRecord(current)) {
    throw new TypeError(`JD 改写板块不存在：${change.section}`)
  }

  let target = current
  let targetIndex = -1
  const items = current.items

  if (mapping.collection) {
    if (!Array.isArray(items)) {
      throw new TypeError(`JD 改写经历列表不存在：${change.section}`)
    }

    const matches = items.flatMap((item, index) =>
      isRecord(item) && item.entryId === change.itemId ? [index] : [],
    )

    if (matches.length !== 1) {
      throw new Error(
        `JD 改写条目不存在或 entryId 重复：${change.section}/${change.itemId}`,
      )
    }

    targetIndex = matches[0]
    target = items[targetIndex]
  }

  if (
    typeof target[mapping.snapshotField] !== 'string' ||
    target[mapping.snapshotField] !== change.before
  ) {
    throw new Error(
      `JD 改写原文不匹配：${change.section}/${change.itemId}/${change.fieldPath}`,
    )
  }
  if (change.before === change.after) {
    return snapshot
  }

  const updated = { ...target, [mapping.snapshotField]: change.after }

  const nextSection = mapping.collection
    ? {
        ...current,
        items: (items as unknown[]).map((item, index) =>
          index === targetIndex ? updated : item,
        ),
      }
    : updated

  return { ...snapshot, [change.section]: nextSection }
}
