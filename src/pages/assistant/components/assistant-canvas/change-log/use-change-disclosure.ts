import type { CanvasModel } from '../../../types'
import { useEffect, useMemo, useState } from 'react'

export function useChangeDisclosure(model: CanvasModel) {
  // 可折叠项（带 diff/摘要详情）id 集合
  const collapsibleIds = useMemo(
    () => model.writes.filter((c) => c.detail).map((c) => c.id),
    [model.writes],
  )

  // 受控展开状态：默认展开 diff 类详情。新变更进来时补充其默认态（不覆盖用户手动折叠过的项）。
  const [openIds, setOpenIds] = useState<Set<string>>(
    () =>
      new Set(
        model.writes.filter((c) => c.detail?.kind === 'diff').map((c) => c.id),
      ),
  )

  const [seenIds, setSeenIds] = useState<Set<string>>(
    () => new Set(model.writes.map((c) => c.id)),
  )

  useEffect(() => {
    const freshDiffIds = model.writes
      .filter((c) => c.detail?.kind === 'diff' && !seenIds.has(c.id))
      .map((c) => c.id)

    const unseen = model.writes
      .filter((c) => !seenIds.has(c.id))
      .map((c) => c.id)

    if (unseen.length === 0) return
    if (freshDiffIds.length > 0)
      setOpenIds((prev) => new Set([...prev, ...freshDiffIds]))

    setSeenIds((prev) => new Set([...prev, ...unseen]))
  }, [model.writes, seenIds])

  const setCollapsibleOpen = (id: string, open: boolean) => {
    setOpenIds((prev) => {
      const next = new Set(prev)

      if (open) next.add(id)
      else next.delete(id)

      return next
    })
  }

  const allExpanded =
    collapsibleIds.length > 0 && collapsibleIds.every((id) => openIds.has(id))

  const toggleAll = () => {
    setOpenIds(allExpanded ? new Set() : new Set(collapsibleIds))
  }

  return { collapsibleIds, openIds, setCollapsibleOpen, allExpanded, toggleAll }
}
