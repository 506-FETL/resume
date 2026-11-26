import type {
  ApplicationStatus,
  JobApplication,
  TrackerMetricKey,
  TrackerSortBy,
  TrackerSortDir,
} from '@/pages/tracker/types'
import supabase from '../../client'
import { trackerProcessError } from '../tracker-companies'

export type TrackerLane = 'list' | ApplicationStatus

export interface TrackerCounts {
  active: Partial<Record<ApplicationStatus, number>>
  archived: Partial<Record<ApplicationStatus, number>>
  archivedTotal: number
  pendingByStage: Partial<Record<ApplicationStatus, number>>
  pending: number
  historicalApplied: number
  unresolvedSubmissions: number
  responded: number
}

export type TrackerHistoryCounts = Pick<
  TrackerCounts,
  'historicalApplied' | 'responded' | 'unresolvedSubmissions' | 'archivedTotal'
>

export interface TrackerFilters {
  keyword?: string
  companyId?: string
  focused?: boolean
  status?: ApplicationStatus
  metric?: TrackerMetricKey
  sortBy?: TrackerSortBy
  sortDir?: TrackerSortDir
  now?: string
  today?: string
  staleBefore?: string
}

export interface TrackerCursor {
  id: string
  time: string
  created: string
  status: ApplicationStatus
}

export async function getTrackerJobPage(
  archived: boolean,
  board: boolean,
  size: number,
  status?: ApplicationStatus,
  cursor?: TrackerCursor,
  filters: TrackerFilters = {},
): Promise<JobApplication[]> {
  const { data, error } = await supabase.rpc('get_tracker_job_page', {
    p_filters: {
      ...filters,
      ...(cursor && filters.sortBy
        ? { cursorCreated: cursor.created, cursorStatus: cursor.status }
        : {}),
    },
    p_archived: archived,
    p_board: board,
    p_status: status ?? null,
    p_limit: size + 1,
    p_cursor_time: cursor?.time ?? null,
    p_cursor_id: cursor?.id ?? null,
  })

  if (error) throw trackerProcessError(error)

  return data.map((row: JobApplication) => ({
    ...row,
    workflowLoaded: false,
    stage_details: [],
    interview_sub_stages: [],
    activities: [],
  }))
}

export async function getTrackerJobCounts(
  filters: TrackerFilters,
  includeHistory = true,
): Promise<TrackerCounts> {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  const staleBefore = new Date(now.getTime() - 7 * 86_400_000)

  const { data, error } = await supabase.rpc('get_tracker_job_counts', {
    p_filters: { ...filters, includeHistory },
    p_today: localDate.toISOString().slice(0, 10),
    p_stale_before: staleBefore.toISOString(),
  })

  if (error) throw trackerProcessError(error)

  return data
}
