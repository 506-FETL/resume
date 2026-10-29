import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import type { CanvasTabKey } from '../../types'
import { PanelRightClose, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DURATION, EASE } from '@/lib/motion'
import { CANVAS_MAX_WIDTH, CANVAS_MIN_WIDTH, CHAT_MIN_WIDTH } from '../../const'
import { useCanvasModel } from '../../hooks/use-canvas-model'
import useAssistantStore from '../../store'
import BoardSnapshot from './board-snapshot'
import { CanvasTabs } from './canvas-tabs'
import ChangeLog from './change-log'
import ResumePreview from './resume-preview'
import VersionTimeline from './version-timeline'

function CanvasPanel({
  value,
  active,
  displayed,
  onExitComplete,
  children,
}: {
  value: CanvasTabKey
  active: CanvasTabKey
  displayed: CanvasTabKey
  onExitComplete: () => void
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const visible = displayed === value
  const exiting = visible && active !== value
  const interactive = visible && !exiting

  useLayoutEffect(() => {
    const panel = panelRef.current

    if (!panel) return

    if (!interactive && panel.contains(document.activeElement)) {
      panel
        .closest('[data-slot=tabs]')
        ?.querySelector<HTMLButtonElement>('[role=tab][data-state=active]')
        ?.focus({ preventScroll: true })
    }

    panel.inert = !interactive

    if (interactive) panel.removeAttribute('aria-hidden')
    else panel.setAttribute('aria-hidden', 'true')
  }, [interactive])

  return (
    <TabsContent forceMount asChild value={value}>
      <motion.div
        ref={panelRef}
        hidden={!visible}
        initial={false}
        animate={{
          opacity: interactive ? 1 : 0,
          transform:
            interactive || reduceMotion ? 'translateY(0px)' : 'translateY(8px)',
        }}
        transition={{
          duration: reduceMotion ? 0 : exiting ? DURATION.fast : DURATION.base,
          ease: exiting ? EASE.in : EASE.out,
          delay: 0,
        }}
        onAnimationComplete={() => {
          if (exiting) onExitComplete()
        }}
        className='absolute inset-0 min-h-0 overflow-hidden'
      >
        {children}
      </motion.div>
    </TabsContent>
  )
}

function CanvasInner() {
  const model = useCanvasModel()
  const reduceMotion = useReducedMotion()
  const { canvasActiveTab, setCanvasActiveTab } = useAssistantStore()
  const [displayedTab, setDisplayedTab] = useState(canvasActiveTab)

  useLayoutEffect(() => {
    if (reduceMotion) setDisplayedTab(canvasActiveTab)
  }, [canvasActiveTab, reduceMotion])

  const panelProps = {
    active: canvasActiveTab,
    displayed: reduceMotion ? canvasActiveTab : displayedTab,
    onExitComplete: () => setDisplayedTab(canvasActiveTab),
  }

  return (
    <Tabs
      value={canvasActiveTab}
      onValueChange={(value) => setCanvasActiveTab(value as CanvasTabKey)}
      className='flex h-full min-h-0 flex-col gap-0'
    >
      <CanvasTabs model={model} />
      {/* 切换只改变可见面板，预览、滚动位置和草稿继续保留。 */}
      <div className='relative min-h-0 flex-1 overflow-hidden'>
        <CanvasPanel value='resume' {...panelProps}>
          <ResumePreview />
        </CanvasPanel>
        <CanvasPanel value='board' {...panelProps}>
          {model.touchedBoard && <BoardSnapshot model={model} />}
        </CanvasPanel>
        <CanvasPanel value='version' {...panelProps}>
          {model.touchedVersion && <VersionTimeline model={model} />}
        </CanvasPanel>
        <CanvasPanel value='changes' {...panelProps}>
          {model.hasWrites && <ChangeLog model={model} />}
        </CanvasPanel>
      </div>
    </Tabs>
  )
}

export default function AssistantCanvas() {
  const {
    canvasOpen,
    canvasMobileOpen,
    canvasWidth,
    setCanvasOpen,
    setCanvasMobileOpen,
    setCanvasWidth,
    layoutMode,
    availableWidth,
  } = useAssistantStore()

  const isMobile = layoutMode === 'drawer'

  const effectiveWidth = Math.min(
    canvasWidth,
    Math.max(CANVAS_MIN_WIDTH, availableWidth - CHAT_MIN_WIDTH),
  )

  const maxWidth = Math.min(
    CANVAS_MAX_WIDTH,
    Math.max(CANVAS_MIN_WIDTH, availableWidth - CHAT_MIN_WIDTH),
  )

  const shouldReduceMotion = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  // 首次打开后保留分页结果与滚动位置，关闭时由外层裁切并禁用交互。
  const [hasOpened, setHasOpened] = useState(canvasOpen)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    if (canvasOpen) setHasOpened(true)
  }, [canvasOpen])

  const onHandlePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startWidth: effectiveWidth }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onHandlePointerMove = (e: ReactPointerEvent) => {
    if (!dragState.current) return

    // 右栏：向左拖变宽
    const next =
      dragState.current.startWidth + (dragState.current.startX - e.clientX)

    setCanvasWidth(Math.min(maxWidth, Math.max(CANVAS_MIN_WIDTH, next)))
  }

  const onHandlePointerUp = (e: ReactPointerEvent) => {
    dragState.current = null
    setDragging(false)

    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (isMobile) {
    return (
      <Drawer
        open={canvasMobileOpen}
        onOpenChange={setCanvasMobileOpen}
        swipeDirection='right'
      >
        <DrawerContent
          data-assistant-canvas
          className='flex-col! gap-0 overflow-hidden p-0 motion-reduce:transition-none'
          overlayClassName='motion-reduce:transition-none'
          finalFocus={() => document.getElementById('assistant-canvas-trigger')}
          style={
            {
              '--drawer-content-height': 'calc(100dvh - 1rem)',
              '--drawer-content-width': 'min(calc(100vw - 1rem), 28rem)',
            } as CSSProperties
          }
        >
          <DrawerHeader className='relative border-b pr-14 text-left'>
            <DrawerTitle>画布</DrawerTitle>
            <DrawerDescription className='sr-only'>
              简历预览与本轮变更。
            </DrawerDescription>
            <DrawerClose
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-lg'
                  className='absolute top-2 right-2 text-muted-foreground'
                  aria-label='关闭画布'
                />
              }
            >
              <X />
            </DrawerClose>
          </DrawerHeader>
          <div className='min-h-0 flex-1 overflow-hidden'>
            <CanvasInner />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <motion.aside
      data-assistant-canvas
      initial={false}
      animate={{
        width: canvasOpen ? effectiveWidth : 0,
        opacity: canvasOpen ? 1 : 0,
      }}
      transition={
        shouldReduceMotion || dragging
          ? { duration: 0 }
          : {
              duration: canvasOpen ? DURATION.slow : DURATION.fast,
              ease: canvasOpen ? EASE.out : EASE.in,
            }
      }
      inert={!canvasOpen}
      className='relative h-full shrink-0 overflow-hidden'
    >
      {(canvasOpen || hasOpened) && (
        <>
          {/* 开关只改变外层占位宽度；内容保持目标宽度，避免预览逐帧缩放。 */}
          <div
            style={{ width: effectiveWidth }}
            className='relative flex h-full min-h-0 flex-col border-l bg-muted/25'
          >
            <div
              role='separator'
              aria-orientation='vertical'
              aria-label='拖拽调整画布宽度'
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              onLostPointerCapture={() => {
                dragState.current = null
                setDragging(false)
              }}
              className='absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50'
            />
            <div className='flex h-12 shrink-0 items-center justify-between border-b px-3'>
              <span className='text-sm font-medium'>画布</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='收起画布'
                    onClick={() => {
                      document
                        .getElementById('assistant-canvas-trigger')
                        ?.focus({ preventScroll: true })

                      setCanvasOpen(false)
                    }}
                  >
                    <PanelRightClose />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='left'>收起画布</TooltipContent>
              </Tooltip>
            </div>
            <CanvasInner />
          </div>
        </>
      )}
    </motion.aside>
  )
}
