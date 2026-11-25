import { useMemo } from 'react'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
} from '@/pages/tracker/const'
import { formatDateTime } from '@/utils/date'
import { dashboardDayStarts, localDateKey } from '../../utils'
import type { DashboardExtras, DashboardResources } from './types'

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function useDashboardExtras(
  resources: DashboardResources,
): DashboardExtras {
  const {
    data: jobs,
    loading: jobsLoading,
    hasLoaded: jobsReady,
  } = resources.jobs

  const {
    data: scores,
    loading: trendLoading,
    hasLoaded: trendReady,
  } = resources.trend

  const {
    data: edits,
    loading: editsLoading,
    hasLoaded: editsReady,
  } = resources.weeklyEdits

  const funnel = useMemo(() => {
    return APPLICATION_STATUS_ORDER.map((status) => ({
      status,
      label: APPLICATION_STATUS_CONFIG[status]?.label ?? status,
      count: jobs.stages[status] ?? 0,
    }))
  }, [jobs])

  const atsTrend = useMemo(
    () =>
      scores.map((summary, index) => ({
        index,
        score: summary.overall_score,
        label: toShortRelative(summary.created_at),
        fullLabel: formatDateTime(summary.created_at),
      })),
    [scores],
  )

  const activity = useMemo(() => {
    const days = dashboardDayStarts()
      .slice(0, 7)
      .map((day) => {
        const key = day.toISOString()
        const editCount = editsReady ? (edits[key] ?? 0) : null
        const applyCount = jobsReady ? (jobs.weeklyApplies[key] ?? 0) : null

        return {
          label: WEEKDAY_LABELS[day.getDay()],
          date: localDateKey(day),
          edits: editCount,
          applies: applyCount,
          total: (editCount ?? 0) + (applyCount ?? 0),
        }
      })

    return days
  }, [jobs, edits, jobsReady, editsReady])

  return {
    funnel,
    atsTrend,
    activity,
    funnelLoading: !jobsReady && jobsLoading,
    atsTrendLoading: !trendReady && trendLoading,
    activityLoading:
      (!jobsReady && jobsLoading) || (!editsReady && editsLoading),
  }
}

function toShortRelative(createdAt: string) {
  const hours = Math.floor((Date.now() - Date.parse(createdAt)) / 3_600_000)
  const days = Math.floor(hours / 24)

  if (days < 1) return hours < 1 ? '刚刚' : `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`

  return `${Math.floor(days / 30)}月前`
}
