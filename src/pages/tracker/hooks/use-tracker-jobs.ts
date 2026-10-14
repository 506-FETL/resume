import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { getCompanies } from '@/lib/supabase/resume'
import useTrackerStore from '../store'
import { getTrackerLoadErrorMeta } from '../utils'

export function useTrackerJobs() {
  const reload = useCallback(async () => {
    if (useTrackerStore.getState().loading)
      return

    useTrackerStore.setState({ loading: true, error: null })
    try {
      const jobs = await getCompanies()
      useTrackerStore.setState({ jobs, loading: false, error: null, isInitialized: true })
    }
    catch (error) {
      const { message, description } = getTrackerLoadErrorMeta(error)
      useTrackerStore.setState({ loading: false, error: message })
      toast.error(message, { description })
    }
  }, [])

  useEffect(() => {
    if (!useTrackerStore.getState().isInitialized)
      reload()
  }, [reload])

  return { reload }
}
