import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useTrackerStore from '../store'
import { selectTrackerListJobs } from '../store/selectors'
import { getTrackerOverviewStats } from '../utils'

export function useTrackerOverview() {
  const {
    jobs,
    error,
    isInitialized,
    showArchived,
    searchKeyword,
    filterCompanyId,
    focusedOnly,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      error: Boolean(state.error),
      isInitialized: state.isInitialized,
      showArchived: state.showArchived,
      searchKeyword: state.searchKeyword,
      filterCompanyId: state.filterCompanyId,
      focusedOnly: state.focusedOnly,
    })),
  )

  const stats = useMemo(
    () =>
      getTrackerOverviewStats(
        jobs,
        showArchived,
        searchKeyword,
        filterCompanyId,
        focusedOnly,
      ),
    [jobs, showArchived, searchKeyword, filterCompanyId, focusedOnly],
  )

  return {
    stats,
    busy: !isInitialized && !error,
    error: !isInitialized && error,
    showArchived,
  }
}
