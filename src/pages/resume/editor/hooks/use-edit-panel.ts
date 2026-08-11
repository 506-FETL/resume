import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

export type EditPanelMode = 'sidebar' | 'drawer'

const MODE_KEY = 'gresume:editor:edit-panel-mode'
const PANEL_WIDTH = 420 // 编辑侧栏固定宽度
const PREVIEW_MIN = 794 // A4 内容自然宽度（缩放前）
const NAV_WIDTH = 256 // 左侧 App 导航展开宽度

/**
 * 桌面编辑面板状态：形态（侧栏/抽屉，localStorage 记忆）+ 开关；
 * 侧栏模式打开且横向空间不足时，自动收起左侧 App 导航让位，关闭时仅恢复「我们收起的那次」。
 * 这些均为本地 UI 态，不参与协作同步。
 */
export function useEditPanel() {
  const { open: navOpen, setOpen: setNavOpen } = useSidebar()
  const [mode, setModeState] = useState<EditPanelMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as EditPanelMode) || 'sidebar'
    }
    catch {
      return 'sidebar'
    }
  })
  const [open, setOpen] = useState(false)
  // 记录左导航是否由我们自动收起，避免误恢复用户手动收起的状态
  const autoCollapsedRef = useRef(false)

  const setMode = useCallback((next: EditPanelMode) => {
    setModeState(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    }
    catch {
      // 存储不可用时忽略，仅保留内存态
    }
  }, [])

  useEffect(() => {
    if (mode !== 'sidebar')
      return

    if (open) {
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
  // 仅在 open/mode 变化时评估让位；navOpen 变化不重复触发
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  return { mode, setMode, open, setOpen }
}
