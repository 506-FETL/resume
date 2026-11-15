import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { History } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import useHistoryStore from '../../store'
import HistoryDetailContent from './detail-content'
import DetailDiscardDialog from './discard-dialog'
import DetailPanelLoadingState from './loading-state'
import HistoryLoadError from '../shared/history-load-error'
import HistoryMotionContent from '../motion-content'

interface HistoryDetailPanelProps {
  state: HistoryDetailPanelState
}

export default function HistoryDetailPanel({ state }: HistoryDetailPanelProps) {
  const {
    currentResume,
    currentResumeError,
    currentResumeLoading,
    reloadCurrentResume,
  } = useHistoryStore()

  const waitingForCurrent = state.selectedEntry === 'current' && !currentResume

  const contentKey = waitingForCurrent
    ? currentResumeError
      ? 'error'
      : 'loading'
    : state.selectedEntry
      ? 'detail'
      : 'empty'

  return (
    <>
      <Card className='flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-none border-0 bg-transparent py-0 shadow-none ring-0'>
        <HistoryMotionContent transitionKey={contentKey}>
          {waitingForCurrent ? (
            currentResumeError ? (
              <HistoryLoadError
                error={currentResumeError}
                retry={reloadCurrentResume}
                loading={currentResumeLoading}
              />
            ) : (
              <DetailPanelLoadingState />
            )
          ) : state.selectedEntry ? (
            <HistoryDetailContent state={state} />
          ) : (
            <Empty className='h-full'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <History />
                </EmptyMedia>
                <EmptyTitle>选择一个版本查看详情</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </HistoryMotionContent>
      </Card>
      <DetailDiscardDialog
        open={state.discardDialogOpen}
        onCancel={state.cancelDiscardChanges}
        onConfirm={state.confirmDiscardChanges}
      />
    </>
  )
}
