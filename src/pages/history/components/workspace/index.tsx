import { History as HistoryIcon, RefreshCcw } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
  const { init, reload, loading, error, currentResume } = useHistoryStore()

  useEffect(() => {
    init(activeResumeId)
  }, [activeResumeId, init])

  const handleReload = async () => {
    await onReloadResumeOptions()
    await reload()
  }

  if (error && !loading && !currentResume) {
    return (
      <Empty className="min-h-[420px] border border-dashed bg-muted/20">
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
    <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
      <HistoryTimeline
        selectedEntry={detailPanelState.selectedEntry}
        onSelectEntry={detailPanelState.requestSelectEntry}
      />
      <HistoryDetailPanel state={detailPanelState} />
    </div>
  )
}
