import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useTrackerStore from '../store'
import type { JobApplication } from '../types'
import { sortJobs } from '../utils/filtering'

export function useSortedJobs(jobs: JobApplication[]) {
  const { sortBy, sortDir, groupByCompany } = useTrackerStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      groupByCompany: state.groupByCompany,
    })),
  )

  const filteredJobs = useMemo(
    () => sortJobs(jobs, sortBy, sortDir),
    [jobs, sortBy, sortDir],
  )

  const displayJobs = useMemo(() => {
    if (!groupByCompany) return filteredJobs

    const groups = new Map<string, typeof filteredJobs>()

    for (const job of filteredJobs) {
      const group = groups.get(job.tracker_company_id) ?? []

      group.push(job)
      groups.set(job.tracker_company_id, group)
    }

    return [...groups.values()].flat()
  }, [filteredJobs, groupByCompany])

  return { displayJobs, groupByCompany }
}
