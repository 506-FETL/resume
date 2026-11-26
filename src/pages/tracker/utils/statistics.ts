import type {
  ApplicationStatus,
  JobApplication,
  TrackerMetricKey,
} from '../types'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER } from '../const'
import { getEndedApplicationStage } from '../workflow'
import { filterJobs, matchesMetric } from './filtering'
import {
  isJobPendingFollowUp,
  comparePendingFollowUpUrgency,
} from './follow-up'

export interface TrackerOverviewStats {
  total: number
  applied: number // 当前搜索与归档范围内，已投递且仍在流程中的职位
  interview: number
  offer: number
  pending: number
  historicalApplied: number // 有唯一投递留档的职位，含已归档
  unresolvedSubmissions: number
  responded: number // 全部记录中曾进入测评或后续阶段的职位
  responseRate: number // responded / historicalApplied，不使用当前已投递数作分母
}

export function resolveTrackerMetricStatus(
  jobs: JobApplication[],
  metric: TrackerMetricKey | null,
): ApplicationStatus | null {
  if (!metric) return null
  if (metric === 'applied')
    return (
      APPLICATION_STATUS_ORDER.find((status) =>
        jobs.some((job) => job.status === status && matchesMetric(job, metric)),
      ) ?? null
    )
  if (metric !== 'pending') return metric

  let pendingJob: JobApplication | undefined

  for (const job of jobs) {
    if (
      isJobPendingFollowUp(job) &&
      (!pendingJob || comparePendingFollowUpUrgency(job, pendingJob) < 0)
    )
      pendingJob = job
  }

  return pendingJob?.status ?? null
}

// 历史到达过的最深阶段索引（基于 APPLICATION_STATUS_ORDER）。
// 结束位置与保存的历史阶段共同还原漏斗；回退保留的真实日期仍属于历史经历。
export function getFurthestStageIndex(job: JobApplication): number {
  const endedAt = getEndedApplicationStage(job)
  let furthest = APPLICATION_STATUS_ORDER.indexOf(endedAt ?? job.status)

  for (const detail of job.stage_details) {
    if (
      detail.status === '已完成' ||
      detail.status === '进行中' ||
      detail.start_date
    ) {
      const idx = APPLICATION_STATUS_ORDER.indexOf(detail.stage)

      if (idx > furthest) furthest = idx
    }
  }

  // 活动记录与当前可见阶段状态分离：回退会重算状态，但不抹去真实到达经历。
  for (const activity of job.activities) {
    if (activity.type !== 'status_change') continue

    for (const [index, stage] of APPLICATION_STATUS_ORDER.entries()) {
      const label = APPLICATION_STATUS_CONFIG[stage].label

      if (
        (activity.label === `推进到「${label}」` ||
          activity.label === `回退到「${label}」` ||
          activity.note === `结束于：${label}` ||
          activity.note === `录用于：${label}`) &&
        index > furthest
      ) {
        furthest = index
      }
    }
  }

  return furthest
}

export function getTrackerOverviewStats(
  jobs: JobApplication[],
  showArchived = false,
  keyword = '',
  companyId: string | null = null,
  focusedOnly = false,
): TrackerOverviewStats {
  const scopedJobs = filterJobs(
    companyId
      ? jobs.filter((job) => job.tracker_company_id === companyId)
      : jobs,
    null,
    keyword,
    showArchived,
    null,
    focusedOnly,
  )

  const responseIdx = APPLICATION_STATUS_ORDER.indexOf('assessment')

  const appliedPlus = jobs.filter((job) => job.has_submission).length

  const responsePlus = jobs.filter(
    (j) => j.has_submission && getFurthestStageIndex(j) >= responseIdx,
  ).length

  const countMetric = (key: TrackerMetricKey) =>
    scopedJobs.filter((job) => matchesMetric(job, key)).length

  const responseRate =
    appliedPlus === 0 ? 0 : Math.round((responsePlus / appliedPlus) * 100)

  return {
    total: scopedJobs.length,
    applied: countMetric('applied'),
    interview: countMetric('interview'),
    offer: countMetric('offer'),
    pending: countMetric('pending'),
    historicalApplied: appliedPlus,
    unresolvedSubmissions: jobs.filter((job) => job.unresolved_submissions)
      .length,
    responded: responsePlus,
    responseRate,
  }
}
