import type { Resume } from '../../types'
import { useMemo } from 'react'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
} from '@/pages/tracker/const'
import {
  getDaysUntil,
  isJobPendingFollowUp,
} from '@/pages/tracker/utils/follow-up'
import { diffDates, formatDateTime } from '@/utils/date'
import type { JobSummaries } from './types'
import type { DashboardResources } from './types'
import type { FollowUpJob } from './types'
import type { FunnelStage } from './types'
import type { AtsTrendPoint } from './types'
import type { ActivityDay } from './types'
import type { DashboardExtras } from './types'

export function compareAtsSummaryChronologically<
  T extends { id: string | number; created_at: string },
>(left: T, right: T) {
  const dateDifference = diffDates(left.created_at, right.created_at)

  if (dateDifference !== 0) return dateDifference

  return String(left.id).localeCompare(String(right.id), undefined, {
    numeric: true,
  })
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 聚合已独立拉取的 job / ats / version 概览，产出首页四个扩展模块的数据：
 * - 待跟进 Top3：isJobPendingFollowUp 口径，按 next_action 紧迫度排序
 * - 求职漏斗：saved→…→offer 按当前状态分布（非历史漏斗，避免 summary 缺 stage_details）
 * - ATS 趋势：所有在线简历最近 8 次检测分，按时间正序
 * - 本周活跃度：近 7 天编辑（version）与投递（job.updated_at）事件按日计数
 * 每个模块只等待自身依赖的数据源，不再被其他请求阻塞。
 */
export function useDashboardExtras(
  resumes: Resume[],
  resumesLoading: boolean,
  resources: DashboardResources,
): DashboardExtras {
  const onlineResumes = useMemo(
    () => resumes.filter((resume) => !resume.isOffline),
    [resumes],
  )

  const { data: jobSummaries, loading: jobsResourceLoading } = resources.jobs
  const { data: atsSummaries, loading: atsResourceLoading } = resources.ats

  const { data: versionSummaries, loading: versionsResourceLoading } =
    resources.versions

  return useMemo(() => {
    const hasCloudResume = onlineResumes.length > 0
    const jobsLoading = jobsResourceLoading
    const atsLoading = resumesLoading || (hasCloudResume && atsResourceLoading)

    const versionsLoading =
      resumesLoading || (hasCloudResume && versionsResourceLoading)

    // —— 待跟进 Top3：逾期优先，其次今天/临期，最后陈旧项 ——
    const pendingJobs = jobSummaries.filter(isJobPendingFollowUp)

    const rankFollowUp = (job: JobSummaries[number]) => {
      const days = getDaysUntil(job.next_action_date)

      // 有明确日期的按天数升序（逾期最靠前）；无日期的排在有日期之后
      return days ?? Number.MAX_SAFE_INTEGER
    }

    const followUps: FollowUpJob[] = [...pendingJobs]
      .sort((a, b) => rankFollowUp(a) - rankFollowUp(b))
      .slice(0, 3)
      .map((job) => ({
        id: job.id,
        company: job.company || '未命名公司',
        position: job.position || '未填写职位',
        status: job.status,
        statusLabel: APPLICATION_STATUS_CONFIG[job.status]?.label ?? job.status,
        daysUntil: getDaysUntil(job.next_action_date),
      }))

    // —— 求职漏斗：按当前状态分布（未归档）——
    const activeJobs = jobSummaries.filter((job) => !job.archived)

    const funnel: FunnelStage[] = APPLICATION_STATUS_ORDER.map((status) => ({
      status,
      label: APPLICATION_STATUS_CONFIG[status]?.label ?? status,
      count: activeJobs.filter((job) => job.status === status).length,
    }))

    // —— ATS 趋势：所有在线简历最近 8 次检测，按时间稳定正序 ——
    const onlineIds = new Set(onlineResumes.map((resume) => resume.resume_id))

    const orderedAtsSummaries = atsSummaries
      .filter((summary) => onlineIds.has(summary.resume_id))
      .filter((summary) => typeof summary.summary?.overall_score === 'number')
      .sort(compareAtsSummaryChronologically)
      .slice(-8)

    const toShortRelative = (createdAt: string): string => {
      const diffMs = Date.now() - new Date(createdAt).getTime()
      const hours = Math.floor(diffMs / 3_600_000)
      const days = Math.floor(diffMs / 86_400_000)

      if (days < 1) return hours < 1 ? '刚刚' : `${hours}小时前`
      if (days < 7) return `${days}天前`
      if (days < 30) return `${Math.floor(days / 7)}周前`

      return `${Math.floor(days / 30)}月前`
    }

    const atsTrend: AtsTrendPoint[] = orderedAtsSummaries.map(
      (summary, index) => ({
        index,
        score: summary.summary!.overall_score as number,
        label: toShortRelative(summary.created_at),
        fullLabel: formatDateTime(summary.created_at),
      }),
    )

    // —— 本周活跃度：本周一→周日，编辑（version）+ 投递（job.updated_at）按日计数 ——
    // 用本地日期键（避免 toISOString 的 UTC 偏移在东八区把事件算到前一天）
    const toLocalKey = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')

      return `${y}-${m}-${day}`
    }

    const activity: ActivityDay[] = []
    const dayKeyToIdx = new Map<string, number>()
    // 定位本周一：getDay() 0=周日..6=周六，(getDay()+6)%7 即回退到本周一的天数
    const monday = new Date()

    monday.setHours(0, 0, 0, 0)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))

    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday)

      d.setDate(monday.getDate() + i)

      const key = toLocalKey(d)

      dayKeyToIdx.set(key, activity.length)

      activity.push({
        label: WEEKDAY_LABELS[d.getDay()],
        date: key,
        edits: 0,
        applies: 0,
        total: 0,
      })
    }

    const bump = (iso: string, field: 'edits' | 'applies') => {
      const key = toLocalKey(new Date(iso))
      const idx = dayKeyToIdx.get(key)

      if (idx === undefined) return

      activity[idx][field] += 1
      activity[idx].total += 1
    }

    for (const version of versionSummaries) {
      if (onlineIds.has(version.resume_id)) bump(version.created_at, 'edits')
    }

    for (const job of jobSummaries) {
      if (job.status !== 'saved') bump(job.updated_at, 'applies')
    }

    return {
      followUps,
      followUpTotal: pendingJobs.length,
      funnel,
      atsTrend,
      activity,
      followUpsLoading: jobsLoading,
      funnelLoading: jobsLoading,
      atsTrendLoading: atsLoading,
      activityLoading: jobsLoading || versionsLoading,
    }
  }, [
    atsResourceLoading,
    atsSummaries,
    jobSummaries,
    jobsResourceLoading,
    onlineResumes,
    resumesLoading,
    versionSummaries,
    versionsResourceLoading,
  ])
}
