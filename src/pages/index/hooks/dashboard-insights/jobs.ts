import type { ApplicationStatus } from '@/pages/tracker/types'
import { TRACKER_FOLLOW_UP_STALE_DAYS } from '@/pages/tracker/utils/follow-up'
import { dashboardDayStarts, localDateKey } from '../../utils'

interface PriorityJob {
  id: string
  company: string
  position: string
  next_action_date: string | null
  next_action: string | null
}

export interface DashboardJobs {
  total: number
  applied: number
  stages: Partial<Record<ApplicationStatus, number>>
  pending: number
  firstPendingId: string | null
  focusedCount: number
  followUps: PriorityJob[]
  focused: (PriorityJob & { status: ApplicationStatus })[]
  nextInterview: {
    job_id: string
    company: string
    position: string
    round_id: string
    label: string
    start_date: string
  } | null
  recent: {
    id: string
    company: string
    position: string
    updated_at: string
  }[]
  weeklyApplies: Record<string, number>
}

export const EMPTY_DASHBOARD_JOBS: DashboardJobs = {
  total: 0,
  applied: 0,
  stages: {},
  pending: 0,
  firstPendingId: null,
  focusedCount: 0,
  followUps: [],
  focused: [],
  nextInterview: null,
  recent: [],
  weeklyApplies: {},
}

export async function loadDashboardJobs(owner: string): Promise<DashboardJobs> {
  const { default: supabase } = await import('@/lib/supabase/client')
  const now = new Date()
  const days = dashboardDayStarts(now)

  const staleBefore = new Date(
    now.getTime() - TRACKER_FOLLOW_UP_STALE_DAYS * 86400000,
  )

  const { data, error } = await supabase.rpc('get_workspace_job_summary', {
    p_owner_id: owner,
    p_today: localDateKey(now),
    p_stale_before: staleBefore.toISOString(),
    p_week_start: localDateKey(days[0]),
  })

  if (error) throw error

  const summary:
    | (Omit<DashboardJobs, 'weeklyApplies'> & { weeklyApplies: number[] })
    | null = data

  if (
    !Array.isArray(summary?.weeklyApplies) ||
    summary.weeklyApplies.length !== 7
  )
    throw new Error('岗位汇总读取失败')

  return {
    ...summary,
    weeklyApplies: Object.fromEntries(
      days
        .slice(0, 7)
        .map((day, index) => [day.toISOString(), summary.weeklyApplies[index]]),
    ),
  }
}
