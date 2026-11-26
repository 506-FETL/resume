import type { TrackerFilters } from '@/lib/supabase/resume/company/tracker-pages'
import type { PersistenceState } from './types'
import type { ViewMode } from '../../types'

function trackerBase(state: PersistenceState) {
  const base: TrackerFilters = {}
  const keyword = state.searchKeyword.trim().toLowerCase()

  if (keyword) base.keyword = keyword
  if (state.filterCompanyId) base.companyId = state.filterCompanyId
  if (state.focusedOnly) base.focused = true

  return base
}

export function trackerBaseKey(state: PersistenceState) {
  return JSON.stringify(trackerBase(state))
}

export function trackerQuery(state: PersistenceState, view: ViewMode) {
  const base = trackerBase(state)
  const filters: TrackerFilters = { ...base }

  if (state.filterStatus) filters.status = state.filterStatus
  if (state.metricFilter) filters.metric = state.metricFilter
  if (
    view === 'list' &&
    state.sortBy !== 'company' &&
    (state.sortDir !== 'desc' || state.sortBy !== 'updated')
  ) {
    filters.sortBy = state.sortBy
    filters.sortDir = state.sortDir
  }

  const localOrder =
    view === 'list' && (state.groupByCompany || state.sortBy === 'company')

  return {
    base,
    filters,
    localOrder,
    key: JSON.stringify(filters),
    baseKey: JSON.stringify(base),
  }
}
