import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useTrackerStore from '../store'
import type { ApplicationStatus, JobApplication } from '../types'

export function useJobWindow(
  jobs: JobApplication[],
  status?: ApplicationStatus,
) {
  const key = status ?? 'list'
  const size = status ? 12 : 32
  const [limit, setLimit] = useState(size)

  const { more, error, loading } = useTrackerStore(
    useShallow((state) => ({
      more: Boolean(state.pageMore[key]),
      error: state.pageErrors[key],
      loading: Boolean(state.pageLoading[key]),
    })),
  )

  const rows = useMemo(
    () => (jobs.length > limit ? jobs.slice(0, limit) : jobs),
    [jobs, limit],
  )

  const local = limit < jobs.length

  const advance = useCallback(() => {
    if (local) setLimit(limit + size)
    else if (more && !loading) {
      useTrackerStore
        .getState()
        .loadMoreJobs(status)
        .then(() => {
          if (!useTrackerStore.getState().pageErrors[key])
            setLimit(limit + size)
        })
        .catch(() => {})
    }
  }, [key, limit, loading, local, more, size, status])

  return { rows, more: local || more, error, loading, advance }
}
