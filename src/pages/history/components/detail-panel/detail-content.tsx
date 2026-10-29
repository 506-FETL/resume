import type { ReactNode, RefObject } from 'react'
import type {
  HistoryDetailPanelState,
  HistoryDetailTab,
} from './use-detail-panel-state'
import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CONTENT_SWITCH } from '@/lib/motion'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import HistoryResumePreview from '../shared/history-resume-preview'
import CurrentOverview from './current-overview'
import DetailHeader from './detail-header'
import HistoryVersionOverview from './history-overview'

interface HistoryDetailContentProps {
  state: HistoryDetailPanelState
}

function DetailTabPanel({
  value,
  active,
  displayed,
  scrollRef,
  onExitComplete,
  children,
}: {
  value: HistoryDetailTab
  active: HistoryDetailTab
  displayed: HistoryDetailTab
  scrollRef: RefObject<HTMLDivElement | null>
  onExitComplete: () => void
  children: ReactNode
}) {
  const { reduceMotion } = useHistoryMotion()
  const visible = displayed === value
  const exiting = visible && active !== value
  const interactive = visible && !exiting

  useLayoutEffect(() => {
    const panel = scrollRef.current

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
  }, [interactive, scrollRef])

  return (
    <TabsContent forceMount asChild value={value}>
      <motion.div
        ref={scrollRef}
        hidden={!visible}
        initial={false}
        animate={{
          opacity: interactive ? 1 : 0,
          transform:
            interactive || reduceMotion ? 'translateY(0px)' : 'translateY(4px)',
        }}
        transition={{
          ...(exiting ? CONTENT_SWITCH.exit : CONTENT_SWITCH.enter),
          ...(reduceMotion && { duration: 0 }),
          delay: 0,
        }}
        onAnimationComplete={() => {
          if (exiting) onExitComplete()
        }}
        className='scrollbar-thin-subtle absolute inset-0 mt-0 min-h-0 overflow-y-auto overscroll-contain'
      >
        {children}
      </motion.div>
    </TabsContent>
  )
}

export default function HistoryDetailContent({
  state,
}: HistoryDetailContentProps) {
  const { reduceMotion } = useHistoryMotion()
  const resumeScrollRef = useRef<HTMLDivElement>(null)
  const overviewScrollRef = useRef<HTMLDivElement>(null)
  const currentResume = useHistoryStore((state) => state.currentResume)

  const loadVersionSnapshot = useHistoryStore(
    (state) => state.loadVersionSnapshot,
  )

  const { activeTab, setActiveTab } = state
  const [displayedTab, setDisplayedTab] = useState(activeTab)

  useLayoutEffect(() => {
    if (reduceMotion) setDisplayedTab(activeTab)
  }, [activeTab, reduceMotion])

  const panelProps = {
    active: activeTab,
    displayed: reduceMotion ? activeTab : displayedTab,
    onExitComplete: () => setDisplayedTab(activeTab),
  }

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
  }, [selectedVersionId, versionSnapshot, loadVersionSnapshot])

  useEffect(() => {
    resumeScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    overviewScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [state.selectedEntry])

  useEffect(() => {
    if (state.editing) {
      setActiveTab('overview')
    }
  }, [state.editing, setActiveTab])

  // current 用当前内容 snapshot；历史版本用按需加载的
  const resumeSnapshot = isCurrent
    ? (currentResume?.snapshot ?? null)
    : versionSnapshot

  // 未选中任何条目（current 无当前简历、或未选版本）→ 不渲染
  if (isCurrent ? !currentResume : !state.selectedVersion) {
    return null
  }

  return (
    <div className='flex h-full min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='shrink-0 px-3 py-3 sm:px-4'>
        <DetailHeader state={state} />
      </div>
      <Separator />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className='flex min-h-0 flex-1 flex-col gap-0 overflow-hidden'
      >
        <div className='shrink-0 px-3 py-2 sm:px-4'>
          <TabsList className='h-8 justify-start'>
            {(
              [
                { value: 'resume', label: '简历预览' },
                { value: 'overview', label: '版本信息' },
              ] as const
            ).map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className='px-3 text-xs'
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Separator />

        <div className='relative min-h-0 flex-1 overflow-hidden'>
          <DetailTabPanel
            value='overview'
            scrollRef={overviewScrollRef}
            {...panelProps}
          >
            <div className='flex flex-col gap-4 p-4 sm:p-5'>
              {isCurrent ? (
                <CurrentOverview />
              ) : (
                <HistoryVersionOverview state={state} />
              )}
            </div>
          </DetailTabPanel>
          <DetailTabPanel
            value='resume'
            scrollRef={resumeScrollRef}
            {...panelProps}
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
                <Skeleton
                  className={cn('h-96 w-full', reduceMotion && 'animate-none')}
                />
              )}
            </div>
          </DetailTabPanel>
        </div>
      </Tabs>
    </div>
  )
}
