import type { UIAction } from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { useEffect, useRef } from 'react'
import useResumeStore from '@/store/resume/form'

interface UseSectionToggleBroadcastOptions {
  isApplyingRemote: { current: boolean }
  broadcastUIAction: (action: UIAction) => void
}

/**
 * 广播编辑区折叠项的展开/收起。
 *
 * 订阅 store 的 openSections，与上一帧做集合 diff：
 * 新增项广播 `section-toggle open=true`，移除项广播 `open=false`。
 * 展开另有 tab-switch（activeTab 联动）负责渲染区滚动定位，本 hook 只负责「收起也能同步」，
 * 补齐此前展开可同步、收起不同步的缺口。应用远端动作期间（isApplyingRemote）不回声。
 */
export function useSectionToggleBroadcast({
  isApplyingRemote,
  broadcastUIAction,
}: UseSectionToggleBroadcastOptions) {
  const openSections = useResumeStore(state => state.openSections)
  const previousRef = useRef<ORDERType[]>(openSections)

  useEffect(() => {
    const prev = previousRef.current
    if (prev === openSections)
      return
    previousRef.current = openSections

    if (isApplyingRemote.current)
      return

    for (const id of openSections) {
      if (!prev.includes(id))
        broadcastUIAction({ kind: 'section-toggle', tabId: id, open: true })
    }
    for (const id of prev) {
      if (!openSections.includes(id))
        broadcastUIAction({ kind: 'section-toggle', tabId: id, open: false })
    }
  }, [openSections, broadcastUIAction, isApplyingRemote])
}
