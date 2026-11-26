import type { JobApplication } from '../../types'
import { useSortedJobs } from '../../hooks/use-sorted-jobs'
import { JobTable } from './job-table/table'

export default function DesktopList({ jobs }: { jobs: JobApplication[] }) {
  const { displayJobs, groupByCompany } = useSortedJobs(jobs)

  return <JobTable jobs={displayJobs} groupByCompany={groupByCompany} />
}
