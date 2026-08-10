import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { useEffect } from 'react'
import { Separator } from '@/components/ui/separator'
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
  const { currentResume } = useHistoryStore()
  const { activeTab, setActiveTab } = state

  const detailSnapshot = state.selectedEntry === 'current'
    ? currentResume?.snapshot
    : state.selectedVersion?.snapshot

  useEffect(() => {
    if (state.editing) {
      setActiveTab('overview')
    }
  }, [state.editing, setActiveTab])

  if (!detailSnapshot) {
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
              {state.selectedEntry === 'current'
                ? <CurrentOverview />
                : <HistoryVersionOverview state={state} />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resume" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-gutter-stable scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-3 py-4 pb-8 sm:px-4 sm:py-5 sm:pb-6">
              <HistoryResumePreview snapshot={detailSnapshot} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
