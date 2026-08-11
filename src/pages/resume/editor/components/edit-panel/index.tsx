import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { PanelRightClose } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CollaborationControls } from '../collaboration/collaboration-controls'
import SidebarEditor from '../sidebar'

interface EditPanelProps {
  open: boolean
  activeTabId: ORDERType
  order: ORDERType[]
  visibilityState: Record<string, boolean>
  fill: string
  stroke: string
  onActivate: (id: ORDERType) => void
  onUpdateOrder: (order: ORDERType[]) => void
  onToggleVisibility: (id: VisibilityItemsType) => void
  onClose: () => void
  onSwitchToDrawer: () => void
}

// 宽度按屏幕宽度比例存储，大屏小屏自适应；额外用像素上下限兜底避免极端屏幕过窄/过宽
const RATIO_KEY = 'gresume:editor:edit-panel-ratio'
const MIN_RATIO = 0.25
const MAX_RATIO = 0.6
const DEFAULT_RATIO = 0.34
const MIN_PX = 320
const MAX_PX = 720

function clampRatio(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
}

function readStoredRatio(): number {
  try {
    const raw = Number(localStorage.getItem(RATIO_KEY))
    if (raw >= MIN_RATIO && raw <= MAX_RATIO)
      return raw
  }
  catch {
    // 存储不可用时用默认比例
  }
  return DEFAULT_RATIO
}

// 比例 → 实际像素宽度（带像素兜底）
function ratioToWidth(ratio: number): number {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth
  return Math.min(MAX_PX, Math.max(MIN_PX, Math.round(vw * ratio)))
}

/**
 * 桌面右侧常驻编辑侧栏：整体高度撑满、自身不滚动，仅表单区内部滚动；
 * 左边缘可拖拽调整宽度（占屏幕宽度比例，随屏幕自适应，localStorage 记忆比例）。
 * 与移动端底部抽屉互斥。
 */
export default function EditPanel({
  open,
  activeTabId,
  order,
  visibilityState,
  fill,
  stroke,
  onActivate,
  onUpdateOrder,
  onToggleVisibility,
  onClose,
  onSwitchToDrawer,
}: EditPanelProps) {
  const reduceMotion = useReducedMotion()
  const [ratio, setRatio] = useState(readStoredRatio)
  const [width, setWidth] = useState(() => ratioToWidth(readStoredRatio()))
  const draggingRef = useRef(false)

  // 屏幕尺寸变化时按比例重算像素宽度
  useEffect(() => {
    const onResize = () => setWidth(ratioToWidth(ratio))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [ratio])

  const onHandlePointerDown = (event: ReactPointerEvent) => {
    event.preventDefault()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.userSelect = 'none'
  }

  const onHandlePointerMove = (event: ReactPointerEvent) => {
    if (!draggingRef.current)
      return
    // 侧栏在右侧：宽度 = 窗口右边缘 - 指针 X，向左拖变宽；换算成比例存储
    const nextWidth = window.innerWidth - event.clientX
    const nextRatio = clampRatio(nextWidth / window.innerWidth)
    setRatio(nextRatio)
    setWidth(ratioToWidth(nextRatio))
  }

  const onHandlePointerUp = (event: ReactPointerEvent) => {
    if (!draggingRef.current)
      return
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.userSelect = ''
  }

  const persistRatio = useCallback(() => {
    try {
      localStorage.setItem(RATIO_KEY, String(ratio))
    }
    catch {
      // 忽略存储失败
    }
  }, [ratio])

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
    }
  }, [])

  if (!open)
    return null

  return (
    <motion.aside
      initial={reduceMotion ? false : { x: width, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ width }}
      className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-background"
    >
      {/* 左边缘拖拽手柄：调整宽度比例 */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整编辑栏宽度"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onLostPointerCapture={persistRatio}
        className={cn(
          'absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize',
          'transition-colors hover:bg-primary/30 active:bg-primary/40',
        )}
      />

      {/* 顶部：协作控制条 + 单个收起入口（不再重复图标） */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b pr-2">
        <div className="min-w-0 flex-1">
          <CollaborationControls plain />
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onSwitchToDrawer}>
                抽屉
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">切换为底部抽屉</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="收起编辑栏" onClick={onClose}>
                <PanelRightClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">收起编辑栏</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 仅此区域滚动，编辑栏整体固定 */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
        <SidebarEditor
          activeTabId={activeTabId}
          order={order}
          visibilityState={visibilityState}
          fill={fill}
          stroke={stroke}
          isMobile={false}
          sortDialogOpen={false}
          onSortDialogOpenChange={() => {}}
          onUpdateActiveTabId={onActivate}
          onUpdateOrder={onUpdateOrder}
          onToggleVisibility={onToggleVisibility}
        />
      </div>
    </motion.aside>
  )
}
