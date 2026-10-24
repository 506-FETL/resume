import type { ApplicationStatus } from '../../../types'
import { Badge } from '@/components/ui/badge'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import { getEndedApplicationStage } from '../../../workflow'
import { InterviewSubStages } from '../interview-sub-stages/index'
import { useStageDetail } from '../use-stage-detail'
import WorkflowDateField from '../workflow-date-field'
import WorkflowNotesEditor from '../workflow-notes-editor'
import WorkflowSaveFeedback from '../workflow-save-feedback'

interface DrawerStageDetailProps {
  displayStage: ApplicationStatus
}

export default function DrawerStageDetail({
  displayStage,
}: DrawerStageDetailProps) {
  const {
    job,
    currentStageDetail,
    currentStatus,
    saveState,
    flush,
    retry,
    updateStage,
    addRound,
    removeRound,
    updateRound,
  } = useStageDetail({ displayStage })
  if (!job) return null

  const saveFeedback = (
    <WorkflowSaveFeedback
      status={saveState?.status ?? 'idle'}
      error={saveState?.error}
      onRetry={retry}
    />
  )
  if (displayStage === 'interview') {
    return (
      <InterviewSubStages
        key={job.id}
        jobId={job.id}
        subStages={job.interview_sub_stages}
        canAdd={job.status === 'interview'}
        saveStatus={saveFeedback}
        onAddSubStage={addRound}
        onDeleteSubStage={removeRound}
        onUpdateSubStage={updateRound}
        onFlush={flush}
      />
    )
  }

  const label = APPLICATION_STATUS_CONFIG[displayStage].label
  const stateLabel =
    currentStatus === '进行中'
      ? '进行中'
      : currentStatus === '已完成'
        ? '已通过'
        : currentStatus === '已拒绝'
          ? '已结束'
          : '未记录'
  const endedAt = getEndedApplicationStage(job)

  return (
    <section className='space-y-5' aria-label={`${label}详情`}>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1.5'>
          <div className='flex items-center gap-2'>
            <h3 className='text-base font-semibold'>{label}</h3>
            <Badge
              variant='outline'
              className='rounded-full text-[11px] font-normal'
            >
              {displayStage === 'offer' && job.status === 'offer'
                ? '已录用'
                : stateLabel}
            </Badge>
          </div>
          {displayStage === 'rejected' &&
            job.status === 'rejected' &&
            endedAt && (
              <p className='text-xs text-muted-foreground'>
                结束于：
                {APPLICATION_STATUS_CONFIG[endedAt].label}
              </p>
            )}
        </div>
        {saveFeedback}
      </header>
      <div className='space-y-5 rounded-xl border bg-card p-4'>
        <WorkflowDateField
          label={
            displayStage === 'offer'
              ? '录用日期'
              : displayStage === 'rejected'
                ? '结束日期'
                : '进入日期'
          }
          value={currentStageDetail?.start_date ?? null}
          onChange={(value) => updateStage({ start_date: value }, true)}
        />
        <div
          className='space-y-2'
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) flush()
          }}
        >
          <p className='text-xs font-medium text-muted-foreground'>阶段备注</p>
          <WorkflowNotesEditor
            jobId={job.id}
            kind='stage'
            targetId={displayStage}
          />
        </div>
      </div>
    </section>
  )
}
