import { ArrowLeft, History as HistoryIcon, RefreshCcw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import useHistoryStore from '../../store'
import HistoryDetailPanel from '../detail-panel'
import { useHistoryDetailPanelState } from '../detail-panel/use-detail-panel-state'
import HistoryTimeline from '../timeline'

interface HistoryWorkspaceProps {
  activeResumeId: string
  onReloadResumeOptions: () => Promise<void>
}

export default function HistoryWorkspace({ activeResumeId, onReloadResumeOptions }: HistoryWorkspaceProps) {
  const detailPanelState = useHistoryDetailPanelState(activeResumeId)
  const { init, reload, loading, error, currentResume, mobilePanel, timelineFocusTarget, clearTimelineFocus } = useHistoryStore()
  const reduceMotion = useReducedMotion()
  const workspaceRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const [narrow, setNarrow] = useState(true)
  const previousPanel = useRef(mobilePanel)
  const hasWorkspace = !(error && !loading && !currentResume)

  useLayoutEffect(() => {
    const element = workspaceRef.current
    if (!element)
      return
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 900))
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasWorkspace])

  useLayoutEffect(() => {
    if (narrow) {
      if (mobilePanel === 'detail' && (previousPanel.current !== 'detail' || timelineRef.current?.contains(document.activeElement))) {
        backRef.current?.focus({ preventScroll: true })
      }
      else if (mobilePanel === 'timeline' && (timelineFocusTarget !== null || detailRef.current?.contains(document.activeElement))) {
        const target = timelineFocusTarget ?? detailPanelState.selectedEntry ?? 'current'
        const button = timelineRef.current?.querySelector<HTMLButtonElement>(`[data-history-entry="${target}"]`)
        if (button)
          button.focus({ preventScroll: true })
        else timelineRef.current?.focus({ preventScroll: true })
      }
    }
    else if (document.activeElement === backRef.current) {
      detailRef.current?.focus({ preventScroll: true })
    }
    previousPanel.current = mobilePanel
    if (timelineFocusTarget !== null)
      clearTimelineFocus()
  }, [clearTimelineFocus, detailPanelState.selectedEntry, mobilePanel, narrow, timelineFocusTarget])

  useEffect(() => {
    init(activeResumeId)
  }, [activeResumeId, init])

  const handleReload = async () => {
    await onReloadResumeOptions()
    await reload()
  }

  if (error && !loading && !currentResume) {
    return (
      <Empty className="min-h-0 flex-1 overflow-y-auto border border-dashed bg-muted/20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>版本记录暂时不可用</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={handleReload}>
            <RefreshCcw data-icon="inline-start" />
            重试
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div ref={workspaceRef} className={cn('relative grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3', !narrow && 'grid-cols-[clamp(16rem,23%,20rem)_minmax(0,1fr)]')}>
      <motion.div
        ref={timelineRef}
        tabIndex={-1}
        aria-label="版本记录"
        inert={narrow && mobilePanel !== 'timeline'}
        initial={false}
        animate={{ opacity: narrow && mobilePanel !== 'timeline' ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.out }}
        className={cn('flex h-full min-h-0 min-w-0 flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring', narrow && 'col-start-1 row-start-1', narrow && mobilePanel !== 'timeline' && 'pointer-events-none absolute inset-0 overflow-hidden')}
      >
        <HistoryTimeline selectedEntry={detailPanelState.selectedEntry} onSelectEntry={detailPanelState.requestSelectEntry} />
      </motion.div>
      <motion.div
        ref={detailRef}
        tabIndex={-1}
        inert={narrow && mobilePanel !== 'detail'}
        initial={false}
        animate={{ opacity: narrow && mobilePanel !== 'detail' ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.out }}
        className={cn('flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring', narrow && 'col-start-1 row-start-1', narrow && mobilePanel !== 'detail' && 'pointer-events-none absolute inset-0 overflow-hidden')}
      >
        <Button ref={backRef} variant="outline" className={cn('h-9 shrink-0 self-start', !narrow && 'hidden')} onClick={detailPanelState.requestBackToTimeline}>
          <ArrowLeft data-icon="inline-start" />
          返回版本列表
        </Button>
        <HistoryDetailPanel state={detailPanelState} />
      </motion.div>
    </div>
  )
}
