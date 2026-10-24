import type { ApplicationStatus } from '../../types'
import useTrackerStore from '../../store'

interface UseStageDetailProps {
  displayStage: ApplicationStatus
}

/** 草稿与保存队列由页面 store 持有；这里只适配当前查看的阶段。 */
export function useStageDetail({ displayStage }: UseStageDetailProps) {
  const job = useTrackerStore((state) => state.selectedJob)
  const saveState = useTrackerStore((state) =>
    job ? state.saveStates[job.id] : undefined,
  )
  const currentStageDetail = job?.stage_details.find(
    (stage) => stage.stage === displayStage,
  )
  const flush = () => {
    if (job)
      useTrackerStore
        .getState()
        .flushWorkflow(job.id)
        .catch(() => {})
  }
  const retry = () => {
    if (job)
      useTrackerStore
        .getState()
        .retryWorkflow(job.id)
        .catch(() => {})
  }
  const updateStage = (
    patch: { start_date?: string | null; notes?: string },
    immediate = false,
  ) => {
    if (job)
      useTrackerStore
        .getState()
        .editStageContent(job.id, displayStage, patch, immediate)
  }
  return {
    job,
    currentStageDetail,
    currentStatus: currentStageDetail?.status ?? '待处理',
    saveState,
    flush,
    retry,
    updateStage,
    addRound: () =>
      job ? useTrackerStore.getState().addInterviewRound(job.id) : null,
    removeRound: (roundId: string) => {
      if (job) useTrackerStore.getState().removeInterviewRound(job.id, roundId)
    },
    updateRound: (
      roundId: string,
      patch: { label?: string; start_date?: string | null; notes?: string },
      immediate = false,
    ) => {
      if (job)
        useTrackerStore
          .getState()
          .editInterviewRound(job.id, roundId, patch, immediate)
    },
  }
}
