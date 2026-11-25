import { useMemo } from 'react'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
} from '@/pages/tracker/const'
import { formatDateTime } from '@/utils/date'
import { dashboardDayStarts } from '../../utils'
import type { ActivityDay, DashboardExtras, DashboardResources } from './types'

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function useDashboardExtras(
  cloudCount: number,
  cloudPending: boolean,
  resources: DashboardResources,
): DashboardExtras {
  const { data: jobs, loading: jobsLoading } = resources.jobs
  const { data: scores, loading: atsTrendLoading } = resources.trend
  const { data: edits, loading: editsLoading } = resources.weeklyEdits

  const funnel = useMemo(() => {
    const counts = new Map<string, number>()

    for (const job of jobs) {
      if (!job.archived)
        counts.set(job.status, (counts.get(job.status) ?? 0) + 1)
    }

    return APPLICATION_STATUS_ORDER.map((status) => ({
      status,
      label: APPLICATION_STATUS_CONFIG[status]?.label ?? status,
      count: counts.get(status) ?? 0,
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
        const count = edits[day.toISOString()] ?? 0

        return {
          label: WEEKDAY_LABELS[day.getDay()],
          date: localDateKey(day),
          edits: count,
          applies: 0,
          total: count,
        }
      })

    const byDate = new Map<string, ActivityDay>(
      days.map((day) => [day.date, day]),
    )

    for (const job of jobs) {
      if (job.status === 'saved') continue

      const day = byDate.get(localDateKey(new Date(job.updated_at)))

      if (day) {
        day.applies += 1
        day.total += 1
      }
    }

    return days
  }, [jobs, edits])

  return {
    funnel,
    atsTrend,
    activity,
    funnelLoading: jobsLoading,
    atsTrendLoading,
    activityLoading:
      jobsLoading || ((cloudPending || cloudCount > 0) && editsLoading),
  }
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toShortRelative(createdAt: string) {
  const hours = Math.floor((Date.now() - Date.parse(createdAt)) / 3_600_000)
  const days = Math.floor(hours / 24)

  if (days < 1) return hours < 1 ? '刚刚' : `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`

  return `${Math.floor(days / 30)}月前`
}
