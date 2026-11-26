import type { ApplicationStatus, TrackerMetricKey } from '../types'
import type {
  TrackerCounts,
  TrackerHistoryCounts,
} from '@/lib/supabase/resume/company/tracker-pages'
import useTrackerStore from '../store'
import type { TrackerStore } from '../store/types'
import { trackerBaseKey } from '../store/workflow-save/job-query'

function overview(
  counts: TrackerCounts | null,
  countsError: string | null,
  history: TrackerHistoryCounts | null,
  showArchived: boolean,
  status: ApplicationStatus | null,
  metric: TrackerMetricKey | null,
) {
  const stageCounts = (showArchived ? counts?.archived : counts?.active) ?? {}
  const visibleStageCounts = { ...stageCounts }

  for (const stage of Object.keys(visibleStageCounts) as ApplicationStatus[]) {
    if (status && stage !== status) visibleStageCounts[stage] = 0
    else if (metric === 'pending')
      visibleStageCounts[stage] = showArchived
        ? 0
        : (counts?.pendingByStage?.[stage] ?? 0)
    else if (
      metric === 'applied' &&
      ['saved', 'offer', 'rejected'].includes(stage)
    )
      visibleStageCounts[stage] = 0
    else if ((metric === 'offer' || metric === 'interview') && stage !== metric)
      visibleStageCounts[stage] = 0
  }

  const total = Object.values(stageCounts).reduce((sum, n) => sum + n, 0)
  const historicalApplied = history?.historicalApplied ?? 0
  const responded = history?.responded ?? 0

  return {
    stats: {
      total,
      applied:
        total -
        (stageCounts.saved ?? 0) -
        (stageCounts.offer ?? 0) -
        (stageCounts.rejected ?? 0),
      interview: stageCounts.interview ?? 0,
      offer: stageCounts.offer ?? 0,
      pending: showArchived ? 0 : (counts?.pending ?? 0),
      historicalApplied,
      responded,
      unresolvedSubmissions: history?.unresolvedSubmissions ?? 0,
      responseRate: historicalApplied
        ? Math.round((responded / historicalApplied) * 100)
        : 0,
    },
    stageCounts,
    visibleStageCounts,
    pendingByStage: showArchived ? {} : (counts?.pendingByStage ?? {}),
    showArchived,
    busy: !counts && !countsError,
    error: !counts && Boolean(countsError),
    historyBusy: !history && !countsError,
    historyError: !history && Boolean(countsError),
  }
}

let previousCounts: TrackerCounts | null | undefined
let previousHistory: TrackerHistoryCounts | null
let previousError: string | null
let previousArchive: boolean
let previousStatus: ApplicationStatus | null
let previousMetric: TrackerMetricKey | null
let result: ReturnType<typeof overview>

function selectOverview(state: TrackerStore) {
  const sameQuery = state.countsKey === trackerBaseKey(state)
  const counts = sameQuery ? state.counts : null
  const error = sameQuery ? state.countsError : null

  if (
    counts !== previousCounts ||
    previousHistory !== state.historyCounts ||
    error !== previousError ||
    previousArchive !== state.showArchived ||
    previousStatus !== state.filterStatus ||
    previousMetric !== state.metricFilter
  ) {
    previousHistory = state.historyCounts
    previousCounts = counts
    previousError = error
    previousArchive = state.showArchived
    previousStatus = state.filterStatus
    previousMetric = state.metricFilter
    result = overview(
      counts,
      error,
      state.historyCounts,
      state.showArchived,
      state.filterStatus,
      state.metricFilter,
    )
  }

  return result
}

export function useTrackerOverview() {
  return useTrackerStore(selectOverview)
}
