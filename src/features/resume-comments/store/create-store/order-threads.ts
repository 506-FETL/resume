import type { ResumeCommentThread } from '../../types.ts'
import type { ResumeCommentStoreState } from '../types.ts'

export function orderThreads(
  threads: ResumeCommentThread[],
  scope: ResumeCommentStoreState['scope'],
) {
  const nodeOrder = new Map(
    scope?.nodeOrder?.map((nodeKey, index) => [nodeKey, index]) ?? [],
  )

  return [...threads]
    .sort((left, right) => {
      if (left.localOnly !== right.localOnly) return left.localOnly ? -1 : 1

      const resolvedDifference =
        Number(Boolean(left.resolvedAt)) - Number(Boolean(right.resolvedAt))

      if (resolvedDifference !== 0) return resolvedDifference

      const nodeDifference =
        (nodeOrder.get(left.anchor.nodeKey) ?? Number.MAX_SAFE_INTEGER) -
        (nodeOrder.get(right.anchor.nodeKey) ?? Number.MAX_SAFE_INTEGER)

      if (nodeDifference !== 0) return nodeDifference

      const offsetDifference =
        left.anchor.startGraphemeOffset - right.anchor.startGraphemeOffset

      if (offsetDifference !== 0) return offsetDifference

      return Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
    })
    .map((thread) => thread.id)
}
