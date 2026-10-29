import { ArrowLeft, History as HistoryIcon, RefreshCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { CONTENT_SWITCH } from '@/lib/motion'
import { cn } from '@/lib/utils'
import useHistoryStore from '../../store'
import HistoryDetailPanel from '../detail-panel'
import { useHistoryDetailPanelState } from '../detail-panel/use-detail-panel-state'
import HistoryTimeline from '../timeline'

interface HistoryWorkspaceProps {
  activeResumeId: string
  onReloadResumeOptions: () => Promise<void>
}

export default function HistoryWorkspace({
  activeResumeId,
  onReloadResumeOptions,
}: HistoryWorkspaceProps) {
  const detailPanelState = useHistoryDetailPanelState(activeResumeId)

  const {
    init,
    reload,
    loading,
    error,
    currentResume,
    mobilePanel,
    timelineFocusTarget,
    clearTimelineFocus,
  } = useHistoryStore()

  const reduceMotion = useReducedMotion()
  const workspaceRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const [narrow, setNarrow] = useState(true)
  const [displayedPanel, setDisplayedPanel] = useState(mobilePanel)
  const previousPanelRef = useRef(mobilePanel)
  const visiblePanel = reduceMotion ? mobilePanel : displayedPanel
  const exiting = narrow && visiblePanel !== mobilePanel
  const timelineVisible = !narrow || visiblePanel === 'timeline'
  const detailVisible = !narrow || visiblePanel === 'detail'
  const timelineInteractive = timelineVisible && !exiting
  const detailInteractive = detailVisible && !exiting
  const hasWorkspace = !(error && !loading && !currentResume)

  useLayoutEffect(() => {
    const element = workspaceRef.current

    if (!element) return

    const observer = new ResizeObserver(([entry]) =>
      setNarrow(entry.contentRect.width < 900),
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [hasWorkspace])

  useLayoutEffect(() => {
    if (!narrow || reduceMotion) setDisplayedPanel(mobilePanel)
  }, [mobilePanel, narrow, reduceMotion])

  useLayoutEffect(() => {
    const timeline = timelineRef.current
    const detail = detailRef.current

    if (!timeline || !detail) return

    // 先把焦点交给常驻容器，再隔离退出面板，避免隐藏聚焦节点。
    if (
      (!timelineInteractive && timeline.contains(document.activeElement)) ||
      (!detailInteractive && detail.contains(document.activeElement))
    ) {
      workspaceRef.current?.focus({ preventScroll: true })
    }

    timeline.inert = !timelineInteractive
    detail.inert = !detailInteractive

    for (const [panel, interactive] of [
      [timeline, timelineInteractive],
      [detail, detailInteractive],
    ] as const) {
      if (interactive) panel.removeAttribute('aria-hidden')
      else panel.setAttribute('aria-hidden', 'true')
    }

    if (exiting) return

    if (narrow) {
      if (
        mobilePanel === 'detail' &&
        (previousPanelRef.current !== 'detail' ||
          document.activeElement === workspaceRef.current)
      ) {
        backRef.current?.focus({ preventScroll: true })
      } else if (
        mobilePanel === 'timeline' &&
        (previousPanelRef.current !== 'timeline' ||
          timelineFocusTarget !== null ||
          document.activeElement === workspaceRef.current)
      ) {
        const target =
          timelineFocusTarget ?? detailPanelState.selectedEntry ?? 'current'

        const button = timeline.querySelector<HTMLButtonElement>(
          `[data-history-entry="${target}"]`,
        )

        if (button) button.focus({ preventScroll: true })
        else timeline.focus({ preventScroll: true })
      }
    } else if (document.activeElement === backRef.current) {
      detail.focus({ preventScroll: true })
    }

    previousPanelRef.current = mobilePanel

    if (timelineFocusTarget !== null) clearTimelineFocus()
  }, [
    clearTimelineFocus,
    detailInteractive,
    detailPanelState.selectedEntry,
    exiting,
    mobilePanel,
    narrow,
    timelineFocusTarget,
    timelineInteractive,
  ])

  useEffect(() => {
    init(activeResumeId)
  }, [activeResumeId, init])

  const handleReload = async () => {
    await onReloadResumeOptions()
    await reload()
  }

  if (error && !loading && !currentResume) {
    return (
      <Empty className='min-h-0 flex-1 overflow-y-auto border border-dashed bg-muted/20'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>版本记录暂时不可用</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant='outline' onClick={handleReload}>
            <RefreshCcw data-icon='inline-start' />
            重试
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div
      ref={workspaceRef}
      tabIndex={-1}
      className={cn(
        'relative grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 outline-none',
        narrow && 'overflow-hidden',
        !narrow && 'grid-cols-[clamp(16rem,23%,20rem)_minmax(0,1fr)]',
      )}
    >
      <motion.div
        ref={timelineRef}
        tabIndex={-1}
        aria-label='版本记录'
        initial={false}
        animate={{
          opacity: timelineInteractive ? 1 : 0,
          transform:
            timelineInteractive || reduceMotion
              ? 'translateX(0px)'
              : 'translateX(-8px)',
        }}
        transition={{
          ...(exiting ? CONTENT_SWITCH.exit : CONTENT_SWITCH.enter),
          ...(reduceMotion && { duration: 0 }),
        }}
        onAnimationComplete={() => {
          if (exiting && visiblePanel === 'timeline')
            setDisplayedPanel(mobilePanel)
        }}
        style={{ visibility: timelineVisible ? 'visible' : 'hidden' }}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          narrow && 'absolute inset-0 col-start-1 row-start-1',
          !timelineInteractive && 'pointer-events-none',
        )}
      >
        <HistoryTimeline
          selectedEntry={detailPanelState.selectedEntry}
          onSelectEntry={detailPanelState.requestSelectEntry}
        />
      </motion.div>
      <motion.div
        ref={detailRef}
        tabIndex={-1}
        initial={false}
        animate={{
          opacity: detailInteractive ? 1 : 0,
          transform:
            detailInteractive || reduceMotion
              ? 'translateX(0px)'
              : 'translateX(8px)',
        }}
        transition={{
          ...(exiting ? CONTENT_SWITCH.exit : CONTENT_SWITCH.enter),
          ...(reduceMotion && { duration: 0 }),
        }}
        onAnimationComplete={() => {
          if (exiting && visiblePanel === 'detail')
            setDisplayedPanel(mobilePanel)
        }}
        style={{ visibility: detailVisible ? 'visible' : 'hidden' }}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          narrow && 'absolute inset-0 col-start-1 row-start-1',
          !detailInteractive && 'pointer-events-none',
        )}
      >
        <Button
          ref={backRef}
          variant='outline'
          className={cn('h-9 shrink-0 self-start', !narrow && 'hidden')}
          onClick={detailPanelState.requestBackToTimeline}
        >
          <ArrowLeft data-icon='inline-start' />
          返回版本列表
        </Button>
        <HistoryDetailPanel state={detailPanelState} />
      </motion.div>
    </div>
  )
}
