import useTrackerStore from './state'

export function showFocusedTrackerJobs() {
  const state = useTrackerStore.getState()

  if (
    state.focusedOnly &&
    !state.searchKeyword &&
    !state.metricFilter &&
    !state.filterCompanyId &&
    !state.showArchived &&
    !state.filterStatus &&
    !state.selectedIds.size
  )
    return

  useTrackerStore.setState({
    showArchived: false,
    filterCompanyId: null,
    filterStatus: null,
    metricFilter: null,
    searchKeyword: '',
    selectedIds: new Set(),
    focusedOnly: true,
  })
}
