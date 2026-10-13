import type { HistoryDetailPanelState } from './use-detail-panel-state'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { LayoutGroup, motion } from 'motion/react'
import { useEffect, useId, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'
import HistoryMotionContent from '../motion-content'
import HistoryResumePreview from '../shared/history-resume-preview'
import CurrentOverview from './current-overview'
import DetailHeader from './detail-header'
import HistoryVersionOverview from './history-overview'

interface HistoryDetailContentProps {
  state: HistoryDetailPanelState
}

export default function HistoryDetailContent({ state,
}: HistoryDetailContentProps) {
  const { reduceMotion, enter, layout } = useHistoryMotion()
  const tabsId = useId()
  const { currentResume, loadVersionSnapshot, snapshotCache } = useHistoryStore()
  const { activeTab, setActiveTab } = state

  const isCurrent = state.selectedEntry === 'current'
  const selectedVersionId = isCurrent ? null : state.selectedVersion?.id ?? null

  // 历史版本的 snapshot 按需加载（列表已不含 snapshot）
  const [versionSnapshot, setVersionSnapshot] = useState<ResumeSnapshot | null>(null)

  useEffect(() => {
    if (selectedVersionId == null) {
      setVersionSnapshot(null)
      return
    }
    const cached = snapshotCache[selectedVersionId]
    if (cached) {
      setVersionSnapshot(cached)
      return
    }
    let cancelled = false
    setVersionSnapshot(null)
    loadVersionSnapshot(selectedVersionId).then((snap) => {
      if (!cancelled)
        setVersionSnapshot(snap)
    })
    return () => {
      cancelled = true
    }
  }, [selectedVersionId, snapshotCache, loadVersionSnapshot])

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
      <div className="shrink-0 px-4 py-4 sm:px-5">
        <DetailHeader state={state} />
      </div>
      <Separator />

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        <LayoutGroup id={tabsId}>
          <div className="shrink-0 px-4 py-2.5 sm:px-5">
            <TabsList className="h-8 justify-start">
              {([{ value: 'resume', label: '简历预览' }, { value: 'overview', label: '版本信息' }] as const).map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="isolate px-3 text-xs data-[state=active]:text-foreground">
                  {activeTab === tab.value && (
                    <motion.span
                      aria-hidden
                      layoutId={reduceMotion ? undefined : 'history-tab-indicator'}
                      transition={layout}
                      className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-background shadow-xs"
                    />
                  )}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </LayoutGroup>
        <Separator />

        <HistoryMotionContent transitionKey={`${activeTab}-${activeTab === 'overview' && state.editing ? 'editing' : 'view'}`}>
          <TabsContent forceMount value={activeTab} className="scrollbar-thin-subtle mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {activeTab === 'overview'
              ? (
                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    {isCurrent ? <CurrentOverview /> : <HistoryVersionOverview state={state} />}
                  </div>
                )
              : (
                  <div className="min-h-full bg-muted/35 p-3 sm:p-5">
                    {resumeSnapshot
                      ? (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={enter}>
                            <HistoryResumePreview snapshot={resumeSnapshot} />
                          </motion.div>
                        )
                      : <Skeleton className={cn('h-96 w-full', reduceMotion && 'animate-none')} />}
                  </div>
                )}
          </TabsContent>
        </HistoryMotionContent>
      </Tabs>
    </div>
  )
}
