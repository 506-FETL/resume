import type { HistoryDetailPanelState } from './use-detail-panel-state'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useEffect, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
      <div className="flex shrink-0 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <DetailHeader state={state} />
      </div>
      <Separator />

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-3 sm:px-6">
          <TabsList className="w-full justify-start sm:w-auto">
            <TabsTrigger value="overview" className="flex-1 sm:flex-none">概览</TabsTrigger>
            <TabsTrigger value="resume" className="flex-1 sm:flex-none">简历</TabsTrigger>
          </TabsList>
        </div>
        <Separator />

        <TabsContent value="overview" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-gutter-stable scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-4 px-4 py-4 pb-8 sm:px-6 sm:py-5 sm:pb-6">
              {isCurrent
                ? <CurrentOverview />
                : <HistoryVersionOverview state={state} />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resume" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-gutter-stable scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-3 py-4 pb-8 sm:px-4 sm:py-5 sm:pb-6">
              {resumeSnapshot
                ? <HistoryResumePreview snapshot={resumeSnapshot} />
                : <Skeleton className="h-96 w-full" />}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
