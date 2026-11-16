import type { TrackerContact } from '../../../types'

// 单行相等判断：用于逐行 dirty 计算，与全局保存解耦。
export function contactEqual(
  a: TrackerContact | undefined,
  b: TrackerContact | undefined,
) {
  if (!a || !b) return false

  return (
    a.id === b.id &&
    a.name === b.name &&
    a.role === b.role &&
    a.channel === b.channel &&
    a.note === b.note
  )
}
