import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { ArrowRightToLine } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CollaborationControls } from '../collaboration/collaboration-controls'
import { AccordionEditor } from './accordion-editor'

interface EditPanelProps {
  open: boolean
  order: ORDERType[]
  visibilityState: Record<string, boolean>
  onActivate: (id: ORDERType) => void
  onUpdateOrder: (order: ORDERType[]) => void
  onToggleVisibility: (id: VisibilityItemsType) => void
  onClose: () => void
}

// 宽度按屏幕宽度比例存储，大屏小屏自适应；额外用像素上下限兜底避免极端屏幕过窄/过宽
const RATIO_KEY = 'gresume:editor:edit-panel-ratio'
const MIN_RATIO = 0.25
const MAX_RATIO = 0.6
const DEFAULT_RATIO = 0.36
const MIN_PX = 320
const MAX_PX = 820

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
 * 内部编辑区为多开折叠列表（AccordionEditor）。与移动端底部抽屉互斥。
 *
 * 动效：进出动画作用于 width（0↔W）+ opacity，而非 transform——因为编辑栏与渲染区是 flex 兄弟、
 * 渲染区 flex-1，动 width 时渲染区靠 flex 自然平滑跟随移动。内层用固定宽度承载内容并由外层 overflow-hidden
 * 裁剪，避免动画期间 @container 断点抖动导致栅格列数跳变；拖拽调宽时过渡时长置 0 保证跟手。
 */
export default function EditPanel({
  open,
  order,
  visibilityState,
  onActivate,
  onUpdateOrder,
  onToggleVisibility,
  onClose,
}: EditPanelProps) {
  const reduceMotion = useReducedMotion()
  const [ratio, setRatio] = useState(readStoredRatio)
  const [width, setWidth] = useState(() => ratioToWidth(readStoredRatio()))
  // 拖拽调宽期间关闭 width 过渡，保证跟手不卡
  const [isResizing, setIsResizing] = useState(false)
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
    setIsResizing(true)
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
    setIsResizing(false)
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

  const widthTransition = reduceMotion || isResizing
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="edit-panel"
          initial={reduceMotion ? false : { width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ width: widthTransition, opacity: { duration: reduceMotion ? 0 : 0.18 } }}
          className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-background"
        >
          {/* 内层固定宽度：动画期间内容一次性按目标宽度布局，由外层裁剪呈现，避免 @container 列数跳变 */}
          <div style={{ width }} className="flex h-full min-h-0 flex-col">
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

            {/* 顶部：协作控制条 + 收起入口 */}
            <div className="flex shrink-0 items-start justify-between gap-2 border-b pr-2">
              <div className="min-w-0 flex-1">
                <CollaborationControls plain />
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="收起编辑栏" onClick={onClose}>
                      <ArrowRightToLine className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">收起编辑栏</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* 仅此区域滚动，编辑栏整体固定；@container/panel 让内部表单按面板宽度自适应列数 */}
            <div className="@container/panel min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
              <AccordionEditor
                order={order}
                visibilityState={visibilityState}
                onActivate={onActivate}
                onUpdateOrder={onUpdateOrder}
                onToggleVisibility={onToggleVisibility}
              />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
