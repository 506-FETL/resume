import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { History } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import useHistoryStore from '../../store'
import HistoryMotionContent from '../motion-content'
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
      <Card className="flex h-[min(80dvh,760px)] min-h-[520px] min-w-0 flex-col gap-0 overflow-hidden rounded-xl border-border/70 py-0 shadow-none lg:sticky lg:top-2 lg:h-[calc(100dvh-17rem)] lg:min-h-[460px]">
        <HistoryMotionContent transitionKey={loading || !currentResume ? 'loading' : state.selectedEntry ?? 'empty'}>
          {loading || !currentResume
            ? <DetailPanelLoadingState />
            : state.selectedEntry
              ? <HistoryDetailContent state={state} />
              : (
                  <Empty className="h-full">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><History /></EmptyMedia>
                      <EmptyTitle>选择一个版本查看详情</EmptyTitle>
                      <EmptyDescription>查看版本内容、编辑说明，或恢复到先前的版本。</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
        </HistoryMotionContent>
      </Card>
      <DetailDiscardDialog open={state.discardDialogOpen} onCancel={state.cancelDiscardChanges} onConfirm={state.confirmDiscardChanges} />
    </>
  )
}
