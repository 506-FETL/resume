import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { PanelRightClose } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCanvasModel } from '../../hooks/use-canvas-model'
import useAssistantStore from '../../store'
import BoardSnapshot from './board-snapshot'
import { CanvasTabs } from './canvas-tabs'
import ChangeLog from './change-log'
import ResumePreview from './resume-preview'
import VersionTimeline from './version-timeline'

function CanvasInner() {
  const model = useCanvasModel()
  const { canvasActiveTab, setCanvasActiveTab } = useAssistantStore()

  return (
    <Tabs value={canvasActiveTab} onValueChange={v => setCanvasActiveTab(v as typeof canvasActiveTab)} className="flex h-full min-h-0 flex-col gap-0">
      <CanvasTabs model={model} />
      {/* forceMount + CSS 隐藏：各 tab 内容只在首次挂载时加载，切换 tab 不再卸载重挂（避免重复拉取/重渲染） */}
      <TabsContent forceMount value="resume" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <ResumePreview />
      </TabsContent>
      <TabsContent forceMount value="board" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        {model.touchedBoard && <BoardSnapshot model={model} />}
      </TabsContent>
      <TabsContent forceMount value="version" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        {model.touchedVersion && <VersionTimeline model={model} />}
      </TabsContent>
      <TabsContent forceMount value="changes" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        {model.hasWrites && <ChangeLog model={model} />}
      </TabsContent>
    </Tabs>
  )
}

export default function AssistantCanvas() {
  const { canvasOpen, canvasMobileOpen, canvasWidth, setCanvasOpen, setCanvasMobileOpen, setCanvasWidth } = useAssistantStore()
  const isMobile = useIsMobile()
  const shouldReduceMotion = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  const dragState = useRef<{ startX: number, startWidth: number } | null>(null)

  const onHandlePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startWidth: canvasWidth }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandlePointerMove = (e: ReactPointerEvent) => {
    if (!dragState.current)
      return
    // 右栏：向左拖变宽
    const next = dragState.current.startWidth + (dragState.current.startX - e.clientX)
    setCanvasWidth(next)
  }
  const onHandlePointerUp = (e: ReactPointerEvent) => {
    dragState.current = null
    setDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (isMobile) {
    return (
      <Drawer open={canvasMobileOpen} onOpenChange={setCanvasMobileOpen} swipeDirection="right">
        <DrawerContent
          className="gap-0 overflow-hidden p-0"
          style={{
            '--drawer-content-height': 'calc(100dvh - 1rem)',
            '--drawer-content-width': 'min(calc(100vw - 1rem), 28rem)',
          } as CSSProperties}
        >
          <DrawerHeader className="border-b text-left">
            <DrawerTitle>画布</DrawerTitle>
            <DrawerDescription>实时预览简历与本轮变更</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CanvasInner />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <AnimatePresence initial={false}>
      {canvasOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: canvasWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={shouldReduceMotion || dragging ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
          style={{ width: canvasWidth }}
          className="relative hidden h-dvh shrink-0 flex-col overflow-hidden border-l bg-muted/25 md:flex"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整画布宽度"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50"
          />
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            <span className="text-sm font-medium">画布</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="收起画布" onClick={() => setCanvasOpen(false)}>
                  <PanelRightClose />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">收起画布</TooltipContent>
            </Tooltip>
          </div>
          <CanvasInner />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
