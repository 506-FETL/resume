import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export default function HistoryDetailContent({ state,
}: HistoryDetailContentProps) {
  const { reduceMotion, enter } = useHistoryMotion()
  const resumeScrollRef = useRef<HTMLDivElement>(null)
  const overviewScrollRef = useRef<HTMLDivElement>(null)
  const currentResume = useHistoryStore(state => state.currentResume)
  const loadVersionSnapshot = useHistoryStore(state => state.loadVersionSnapshot)
  const { activeTab, setActiveTab } = state

  const isCurrent = state.selectedEntry === 'current'
  const selectedVersionId = isCurrent ? null : state.selectedVersion?.id ?? null

  // 缓存命中时同步读取，避免先渲染空状态再通过 effect 重建预览。
  const versionSnapshot = useHistoryStore(state => selectedVersionId === null ? null : state.snapshotCache[selectedVersionId] ?? null)

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
  const resumeSnapshot = isCurrent ? currentResume?.snapshot ?? null : versionSnapshot

  // 未选中任何条目（current 无当前简历、或未选版本）→ 不渲染
  if (isCurrent ? !currentResume : !state.selectedVersion) {
    return null
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-3 sm:px-4">
        <DetailHeader state={state} />
      </div>
      <Separator />

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        <div className="shrink-0 px-3 py-2 sm:px-4">
          <TabsList className="h-8 justify-start">
            {([{ value: 'resume', label: '简历预览' }, { value: 'overview', label: '版本信息' }] as const).map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="isolate px-3 text-xs transition-none data-[state=active]:text-foreground after:transition-none">
                {activeTab === tab.value && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-background shadow-xs"
                  />
                )}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Separator />

        <TabsContent ref={overviewScrollRef} forceMount value="overview" hidden={activeTab !== 'overview'} inert={activeTab !== 'overview'} className={cn('scrollbar-thin-subtle mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain', activeTab !== 'overview' && 'hidden')}>
          <motion.div animate={{ opacity: activeTab === 'overview' ? 1 : 0 }} transition={enter} className="flex flex-col gap-4 p-4 sm:p-5">
            {isCurrent ? <CurrentOverview /> : <HistoryVersionOverview state={state} />}
          </motion.div>
        </TabsContent>
        <TabsContent ref={resumeScrollRef} forceMount value="resume" hidden={activeTab !== 'resume'} inert={activeTab !== 'resume'} className={cn('scrollbar-thin-subtle mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain', activeTab !== 'resume' && 'hidden')}>
          <motion.div animate={{ opacity: activeTab === 'resume' ? 1 : 0 }} transition={enter} className="min-h-full bg-muted/35 p-2 sm:p-4">
            {resumeSnapshot
              ? <HistoryResumePreview snapshot={resumeSnapshot} projectionReferenceDate={isCurrent ? undefined : state.selectedVersion?.projection_reference_date} />
              : <Skeleton className={cn('h-96 w-full', reduceMotion && 'animate-none')} />}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
