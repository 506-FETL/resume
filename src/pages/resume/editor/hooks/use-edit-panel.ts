import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

const PANEL_WIDTH = 420 // 编辑侧栏参考宽度（用于让位判断）
const PREVIEW_MIN = 794 // A4 内容自然宽度（缩放前）
const NAV_WIDTH = 256 // 左侧 App 导航展开宽度

/**
 * 桌面编辑面板状态：仅开关 + 窄屏自动收起左侧 App 导航让位。
 * 打开且横向空间不足时自动收起左导航，关闭时仅恢复「我们收起的那次」，
 * 避免误恢复用户手动收起的状态。均为本地 UI 态，不参与协作同步。
 */
export function useEditPanel() {
  const { open: navOpen, setOpen: setNavOpen } = useSidebar()
  const [open, setOpen] = useState(false)
  // 记录左导航是否由我们自动收起
  const autoCollapsedRef = useRef(false)

  const evaluate = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      // 可用宽度扣掉侧栏与预览最小宽度后，若容不下左导航则收起
      if (navOpen && window.innerWidth - PANEL_WIDTH - PREVIEW_MIN < NAV_WIDTH) {
        autoCollapsedRef.current = true
        setNavOpen(false)
      }
    }
    else if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false
      setNavOpen(true)
    }
  }, [navOpen, setNavOpen])

  useEffect(() => {
    evaluate(open)
  // 仅在 open 变化时评估让位；navOpen 变化不重复触发
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return { open, setOpen }
}
