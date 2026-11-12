import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { PaperSkeleton } from '@/components/loading-skeleton'
import { cn } from '@/lib/utils'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import HistoryResumePreview from '../shared/history-resume-preview'
import CurrentOverview from './current-overview'
import DetailHeader from './detail-header'
import HistoryVersionOverview from './history-overview'

interface HistoryDetailContentProps {
  state: HistoryDetailPanelState
}

export default function HistoryDetailContent({
  state,
}: HistoryDetailContentProps) {
  const { reduceMotion, surfaceProps } = useHistoryMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const overviewTriggerRef = useRef<HTMLButtonElement>(null)
  const overviewContentRef = useRef<HTMLDivElement>(null)
  const currentResume = useHistoryStore((state) => state.currentResume)

  const snapshotGeneration = useHistoryStore(
    (state) => state.snapshotGeneration,
  )

  const loadVersionSnapshot = useHistoryStore(
    (state) => state.loadVersionSnapshot,
  )

  const { overviewOpen, setOverviewOpen } = state
  const isCurrent = state.selectedEntry === 'current'

  const selectedVersionId = isCurrent
    ? null
    : (state.selectedVersion?.id ?? null)

  // 缓存命中时同步读取，避免先渲染空状态再通过 effect 重建预览。
  const versionSnapshot = useHistoryStore((state) =>
    selectedVersionId === null
      ? null
      : (state.snapshotCache[selectedVersionId] ?? null),
  )

  useEffect(() => {
    if (selectedVersionId !== null && !versionSnapshot)
      loadVersionSnapshot(selectedVersionId)
  }, [
    selectedVersionId,
    versionSnapshot,
    loadVersionSnapshot,
    snapshotGeneration,
  ])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    overviewContentRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [state.selectedEntry, state.editing])

  const resumeSnapshot = isCurrent
    ? (currentResume?.snapshot ?? null)
    : versionSnapshot

  if (isCurrent ? !currentResume : !state.selectedVersion) {
    return null
  }

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
      <div className='shrink-0 px-3 pt-4 pb-3 sm:px-5 sm:pt-5 [@media(max-height:500px)]:py-0'>
        <DetailHeader state={state} />
      </div>

      <div className='flex min-h-0 flex-1 flex-col'>
        {/* 扣除常驻触发器后，信息区最多占剩余高度的一半。 */}
        <Collapsible
          {...surfaceProps}
          open={overviewOpen}
          onOpenChange={(open) => {
            if (
              !open &&
              overviewContentRef.current?.contains(document.activeElement)
            ) {
              overviewTriggerRef.current?.focus({ preventScroll: true })
            }

            setOverviewOpen(open)
          }}
          className={`${surfaceProps.className} mx-3 flex max-h-[calc(50%+1.375rem)] min-h-0 shrink-0 flex-col overflow-hidden border-t border-border/60 sm:mx-5 [@media(max-height:500px)]:max-h-[calc(50%+1.125rem)]`}
        >
          <CollapsibleTrigger asChild>
            <Button
              ref={overviewTriggerRef}
              variant='ghost'
              disabled={state.editing}
              className='my-1 h-9 w-full shrink-0 justify-between rounded-lg px-2 text-xs font-medium text-muted-foreground aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50 [@media(max-height:500px)]:my-0'
            >
              {isCurrent ? '当前简历信息' : '版本信息'}
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-3.5 transition-transform duration-(--history-base) ease-(--history-ease)',
                  overviewOpen && 'rotate-180',
                )}
                style={reduceMotion ? { transitionDuration: '0s' } : undefined}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent
            ref={overviewContentRef}
            role='region'
            aria-label={isCurrent ? '当前简历信息' : '版本信息'}
            tabIndex={overviewOpen ? 0 : -1}
            inert={!overviewOpen}
            aria-hidden={!overviewOpen || undefined}
            className='scrollbar-thin-subtle min-h-0 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
            style={{
              animationDuration: overviewOpen
                ? 'var(--history-base)'
                : 'var(--history-fast)',
              animationTimingFunction: overviewOpen
                ? 'var(--history-ease)'
                : 'var(--history-exit-ease)',
            }}
          >
            <div className='min-w-0 px-2 pt-1 pb-5'>
              {isCurrent ? (
                <CurrentOverview />
              ) : (
                <HistoryVersionOverview state={state} />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div
          ref={scrollRef}
          role='region'
          aria-label='简历预览'
          tabIndex={0}
          className='scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        >
          <div className='min-h-full bg-muted/35 p-2 sm:p-4'>
            {resumeSnapshot ? (
              <HistoryResumePreview
                snapshot={resumeSnapshot}
                projectionReferenceDate={
                  isCurrent
                    ? undefined
                    : state.selectedVersion?.projection_reference_date
                }
              />
            ) : (
              <PaperSkeleton
                label='正在加载版本预览'
                className='mx-auto max-w-[794px] shadow-sm'
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
