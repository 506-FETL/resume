import type { ApplicationStatus, JobApplication } from '../types'

export const TRACKER_FOLLOW_UP_STALE_DAYS = 7

// 停留天数：距上次更新的自然天数
export function getDaysInStage(job: { updated_at: string }): number {
  const last = new Date(job.updated_at).getTime()

  if (Number.isNaN(last)) return 0

  return Math.max(0, Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24)))
}

// 距今天的自然天数：负=已逾期，0=今天，正=未来。无效日期返回 null。
export function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null

  const target = new Date(`${dateStr}T00:00:00`).getTime()

  if (Number.isNaN(target)) return null

  const startOfToday = new Date()

  startOfToday.setHours(0, 0, 0, 0)

  return Math.round((target - startOfToday.getTime()) / (1000 * 60 * 60 * 24))
}

// 待跟进口径所需的最小字段结构（JobApplication 与列表摘要均满足）
export interface PendingFollowUpJob {
  status: ApplicationStatus
  updated_at: string
  archived: boolean
  next_action_date: string | null
}

// 待跟进口径：终态(offer/rejected)与已归档不计。
// 有 next_action_date 时以“今天到期或已逾期”为准；否则回退到陈旧度阈值。
export function isJobPendingFollowUp(job: PendingFollowUpJob): boolean {
  if (job.archived || job.status === 'offer' || job.status === 'rejected')
    return false

  const daysUntil = getDaysUntil(job.next_action_date)

  if (daysUntil !== null) return daysUntil <= 0

  return getDaysInStage(job) >= TRACKER_FOLLOW_UP_STALE_DAYS
}

export function comparePendingFollowUpUrgency(
  left: JobApplication,
  right: JobApplication,
) {
  const leftHasDate = getDaysUntil(left.next_action_date) !== null
  const rightHasDate = getDaysUntil(right.next_action_date) !== null

  if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1

  if (leftHasDate && rightHasDate) {
    const dateDifference = left.next_action_date!.localeCompare(
      right.next_action_date!,
    )

    if (dateDifference !== 0) return dateDifference
  }

  const updatedDifference =
    Date.parse(left.updated_at) - Date.parse(right.updated_at)

  if (Number.isFinite(updatedDifference) && updatedDifference !== 0)
    return updatedDifference

  return left.id.localeCompare(right.id)
}

export type NextActionTone = 'overdue' | 'today' | 'upcoming'

export interface NextActionBadge {
  label: string
  tone: NextActionTone
}

// 下一步日期徽标：逾期/今天/未来。无日期返回 null。
export function getNextActionBadge(
  job: JobApplication,
): NextActionBadge | null {
  // 终态与已归档不再提示下一步。
  if (job.archived || job.status === 'offer' || job.status === 'rejected')
    return null

  const daysUntil = getDaysUntil(job.next_action_date)

  if (daysUntil === null) return null

  if (daysUntil < 0)
    return { label: `逾期 ${Math.abs(daysUntil)} 天`, tone: 'overdue' }
  if (daysUntil === 0) return { label: '今天', tone: 'today' }
  if (daysUntil === 1) return { label: '明天', tone: 'upcoming' }

  return { label: `${daysUntil} 天后`, tone: 'upcoming' }
}
