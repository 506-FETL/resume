import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { getTrackerAccountScope, isTrackerAccountScopeCurrent } from '../lib/account-scope'
import useTrackerStore from '../store'
import { getTrackerLoadErrorMeta } from '../utils'

export function useTrackerJobs() {
  const scope = useTrackerStore(state => state.accountScope)
  const reload = useCallback(async () => {
    const requestScope = getTrackerAccountScope()
    if (useTrackerStore.getState().loading)
      return

    try {
      await useTrackerStore.getState().reloadJobs()
    }
    catch (error) {
      if (!isTrackerAccountScopeCurrent(requestScope))
        return
      const { message, description } = getTrackerLoadErrorMeta(error)
      toast.error(message, { description })
    }
  }, [])

  useEffect(() => {
    if (scope.userId && !useTrackerStore.getState().isInitialized)
      reload()
  }, [reload, scope])

  useEffect(() => {
    const flush = () => {
      if (isTrackerAccountScopeCurrent(scope))
        useTrackerStore.getState().flushPendingWorkflows().catch(() => {})
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden')
        flush()
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isTrackerAccountScopeCurrent(scope) || !useTrackerStore.getState().hasPendingWorkflow())
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
      flush()
    }
  }, [scope])

  return { reload }
}
