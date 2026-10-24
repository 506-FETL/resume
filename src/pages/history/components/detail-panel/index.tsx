import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { History } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import useHistoryStore from '../../store'
import HistoryDetailContent from './detail-content'
import DetailDiscardDialog from './discard-dialog'
import DetailPanelLoadingState from './loading-state'

interface HistoryDetailPanelProps {
  state: HistoryDetailPanelState
}

export default function HistoryDetailPanel({ state }: HistoryDetailPanelProps) {
  const loading = useHistoryStore(state => state.loading)
  const currentResume = useHistoryStore(state => state.currentResume)

  return (
    <>
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl border-border/70 py-0 shadow-none">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {loading || !currentResume
            ? <DetailPanelLoadingState />
            : state.selectedEntry
              ? <HistoryDetailContent state={state} />
              : (
                  <Empty className="h-full">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><History /></EmptyMedia>
                      <EmptyTitle>选择一个版本查看详情</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
        </div>
      </Card>
      <DetailDiscardDialog open={state.discardDialogOpen} onCancel={state.cancelDiscardChanges} onConfirm={state.confirmDiscardChanges} />
    </>
  )
}
