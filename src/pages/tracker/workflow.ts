import type { ApplicationStatus, InterviewSubStage, JobApplication, StageDetail } from './types'
import { ACTIVE_APPLICATION_STAGES, APPLICATION_STATUS_CONFIG } from './const'

export type ActiveApplicationStage = typeof ACTIVE_APPLICATION_STAGES[number]
export type JobWorkflow = Pick<JobApplication, 'status' | 'stage_details' | 'interview_sub_stages'> & Partial<Pick<JobApplication, 'activities'>>

function stageIndex(status: ApplicationStatus): number {
  return ACTIVE_APPLICATION_STAGES.findIndex(stage => stage === status)
}

function hasStageHistory(detail: StageDetail): boolean {
  return detail.status === '已完成' || detail.status === '进行中' || Boolean(detail.start_date)
}

function getLastActiveActivityStage(job: JobWorkflow): ActiveApplicationStage | null {
  for (const activity of [...(job.activities ?? [])].reverse()) {
    if (activity.type !== 'status_change')
      continue
    for (const stage of ACTIVE_APPLICATION_STAGES) {
      const label = APPLICATION_STATUS_CONFIG[stage].label
      if (activity.note === `结束于：${label}` || activity.note === `录用于：${label}` || activity.label.endsWith(`「${label}」`))
        return stage
    }
  }
  return null
}

function getRecordedOfferSourceStage(job: JobWorkflow): ActiveApplicationStage | null {
  const terminal = job.stage_details.find(detail => detail.stage === 'offer')
  if (terminal?.source_stage !== undefined)
    return terminal.source_stage
  const latest = [...(job.activities ?? [])].reverse().find(activity => activity.type === 'status_change')
  if (!latest?.label.endsWith(`「${APPLICATION_STATUS_CONFIG.offer.label}」`))
    return null
  return ACTIVE_APPLICATION_STAGES.find(stage => latest.note === `录用于：${APPLICATION_STATUS_CONFIG[stage].label}`) ?? null
}

// 结束来源只能取自明确的结束标记、真实状态活动或仍保留的当前阶段。
// 旧代码可能将所有节点标红；这种情况下不能把最末节点当成结束来源。
export function getEndedApplicationStage(job: JobWorkflow): ActiveApplicationStage | null {
  if (job.status !== 'rejected')
    return null

  const terminal = job.stage_details.find(detail => detail.stage === 'rejected')
  if (terminal?.source_stage !== undefined)
    return terminal.source_stage

  const ended = job.stage_details.filter(detail => stageIndex(detail.stage) >= 0 && detail.status === '已拒绝')
  if (ended.length === 1)
    return ended[0].stage as ActiveApplicationStage

  const activityStage = getLastActiveActivityStage(job)
  if (activityStage)
    return activityStage

  const current = job.stage_details.filter(detail => stageIndex(detail.stage) >= 0 && detail.status === '进行中')
  return current.length === 1 ? current[0].stage as ActiveApplicationStage : null
}

export function normalizeInterviewSubStages(
  status: ApplicationStatus,
  rounds: readonly InterviewSubStage[],
): InterviewSubStage[] {
  // ECMAScript 的稳定排序保证相同 order 保持原始顺序；日期不会改变当前轮次。
  const ordered = [...rounds].sort((a, b) => a.order - b.order)
  return ordered.map((round, index) => ({
    ...round,
    status: status === 'offer' || ((status === 'interview' || status === 'rejected') && index < ordered.length - 1)
      ? '已完成'
      : status === 'interview'
        ? '进行中'
        : status === 'rejected'
          ? '已拒绝'
          : '待处理',
  }))
}

export function normalizeJobWorkflow<T extends JobWorkflow>(job: T): T {
  const currentIndex = stageIndex(job.status)
  const endedAt = getEndedApplicationStage(job)
  const endIndex = endedAt === null ? -1 : stageIndex(endedAt)
  const stages: ApplicationStatus[] = [...ACTIVE_APPLICATION_STAGES, 'offer']
  if (job.stage_details.some(detail => detail.stage === 'rejected'))
    stages.push('rejected')

  const stageDetails = stages.map((stage): StageDetail => {
    const existing = job.stage_details.find(detail => detail.stage === stage)
    const detail: StageDetail = existing ? { ...existing } : { stage, status: '待处理', start_date: null, notes: '' }
    const index = stageIndex(stage)

    if (index >= 0) {
      if (job.status === 'rejected' && stage === endedAt)
        detail.status = '已拒绝'
      else if (index === currentIndex)
        detail.status = '进行中'
      else if (job.status === 'rejected' && endIndex < 0 && existing?.status === '已完成')
        detail.status = '已完成'
      else if ((job.status === 'offer' || index < currentIndex || (endIndex >= 0 && index < endIndex)) && existing && hasStageHistory(existing))
        detail.status = '已完成'
      else
        detail.status = '待处理'
    }
    else {
      detail.status = stage === job.status ? (stage === 'offer' ? '已完成' : '已拒绝') : '待处理'
    }
    return detail
  })

  return {
    ...job,
    stage_details: stageDetails,
    interview_sub_stages: normalizeInterviewSubStages(job.status, job.interview_sub_stages),
  }
}

export function transitionJobWorkflow<T extends JobWorkflow>(
  job: T,
  target: ApplicationStatus,
  date = new Date().toISOString().slice(0, 10),
): T {
  const normalized = normalizeJobWorkflow(job)
  if (job.status === target)
    return normalized

  const source = stageIndex(job.status) >= 0
    ? job.status
    : job.status === 'rejected'
      ? getEndedApplicationStage(normalized)
      : getRecordedOfferSourceStage(normalized)
  // 进入终态不填前序日期；跨过未记录阶段也不创造其完成经历。
  const stageDetails = normalized.stage_details.map((detail): StageDetail => {
    if ((target === 'offer' || target === 'rejected') && detail.stage === target)
      return { ...detail, source_stage: source as ActiveApplicationStage | null, start_date: target === 'offer' ? detail.start_date || date || null : detail.start_date }
    if (target === 'rejected' && detail.stage === source)
      return { ...detail, status: '已拒绝' }
    if (detail.stage === target)
      return { ...detail, start_date: detail.start_date || date || null }
    if (detail.stage === source && (target === 'offer' || stageIndex(target) > stageIndex(detail.stage)))
      return { ...detail, status: '已完成' }
    return detail
  })
  if (target === 'rejected' && !stageDetails.some(detail => detail.stage === 'rejected'))
    stageDetails.push({ stage: 'rejected', status: '已拒绝', start_date: null, notes: '', source_stage: source as ActiveApplicationStage | null })

  return normalizeJobWorkflow({ ...normalized, status: target, stage_details: stageDetails })
}
