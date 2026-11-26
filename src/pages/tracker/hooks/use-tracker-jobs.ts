import { preloadTrackerView } from '../lib/preload-view'
import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ViewMode } from '../types'
import { toast } from 'sonner'
import {
  getTrackerAccountScope,
  finishTrackerVisit,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import useTrackerStore from '../store'
import { getTrackerLoadErrorMeta } from '../utils'

export function useTrackerJobs(mode: ViewMode) {
  const scope = useTrackerStore((state) => state.accountScope)

  const query = useTrackerStore(
    useShallow((state) => [
      state.showArchived,
      state.searchKeyword.trim(),
      state.filterStatus,
      state.metricFilter,
      state.filterCompanyId,
      state.focusedOnly,
      state.groupByCompany,
      state.sortBy,
      state.sortDir,
    ]),
  )

  useEffect(() => {
    if (!scope.userId) return

    preloadTrackerView(mode).catch(() => {})
  }, [mode, scope])

  useEffect(() => {
    if (!scope.userId) return

    useTrackerStore
      .getState()
      .ensureJobsView(mode)
      .catch(() => {})
  }, [mode, query, scope])

  const reload = useCallback(async () => {
    const requestScope = getTrackerAccountScope()

    if (useTrackerStore.getState().loading) return

    try {
      await useTrackerStore.getState().reloadJobs()
    } catch (error) {
      if (!isTrackerAccountScopeCurrent(requestScope)) return

      const { message, description } = getTrackerLoadErrorMeta(error)

      toast.error(message, { description })
    }
  }, [])

  useEffect(() => {
    const flush = () => {
      if (isTrackerAccountScopeCurrent(scope))
        useTrackerStore
          .getState()
          .flushPendingWorkflows()
          .catch(() => {})
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (
        !isTrackerAccountScopeCurrent(scope) ||
        !useTrackerStore.getState().hasPendingWorkflow()
      )
        return

      flush()
      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', handleBeforeUnload)

      if (isTrackerAccountScopeCurrent(scope)) {
        useTrackerStore.getState().resetCompanyOptions()
        finishTrackerVisit()
      }

      flush()
    }
  }, [scope])

  return { reload }
}
