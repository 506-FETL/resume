import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useTrackerStore from '../store'
import { selectTrackerListJobs } from '../store/selectors'
import { getTrackerOverviewStats } from '../utils'

export function useTrackerOverview() {
  const { jobs, loading, error, isInitialized, showArchived, searchKeyword } =
    useTrackerStore(
      useShallow((state) => ({
        jobs: selectTrackerListJobs(state),
        loading: state.loading,
        error: Boolean(state.error),
        isInitialized: state.isInitialized,
        showArchived: state.showArchived,
        searchKeyword: state.searchKeyword,
      })),
    )

  const stats = useMemo(
    () => getTrackerOverviewStats(jobs, showArchived, searchKeyword),
    [jobs, showArchived, searchKeyword],
  )

  return {
    stats,
    busy: loading || (!isInitialized && !error),
    error,
    showArchived,
  }
}
