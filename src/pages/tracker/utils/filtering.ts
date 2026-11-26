import type {
  ApplicationStatus,
  JobApplication,
  TrackerMetricKey,
  TrackerSortBy,
  TrackerSortDir,
} from '../types'
import { APPLICATION_STATUS_ORDER } from '../const'
import { getDaysInStage, isJobPendingFollowUp } from './follow-up'

// 指标计数与点击筛选共用口径；阶段菜单仍按单个阶段匹配。
export function matchesMetric(
  job: JobApplication,
  key: TrackerMetricKey,
): boolean {
  switch (key) {
    case 'applied':
      return [
        'applied',
        'assessment',
        'screen',
        'written',
        'interview',
      ].includes(job.status)
    case 'interview':
      return job.status === 'interview'
    case 'offer':
      return job.status === 'offer'
    case 'pending':
      return isJobPendingFollowUp(job)
    default:
      return true
  }
}

export function filterJobs(
  jobs: JobApplication[],
  filterStatus: ApplicationStatus | null,
  keyword: string,
  showArchived = true,
  metricFilter: TrackerMetricKey | null = null,
  focusedOnly = false,
): JobApplication[] {
  const trimmed = keyword.trim().toLowerCase()

  return jobs.filter((job) => {
    // showArchived 打开 = 「已归档视图」，只看已归档；关闭 = 常规视图，隐藏已归档
    if (showArchived ? !job.archived : job.archived) return false
    if (filterStatus && job.status !== filterStatus) return false
    if (focusedOnly && !job.focused_at) return false
    if (metricFilter && !matchesMetric(job, metricFilter)) return false
    if (!trimmed) return true

    return [job.company, job.position, job.location, job.salary ?? ''].some(
      (field) => field.toLowerCase().includes(trimmed),
    )
  })
}

// 列表排序比较器（返回新数组，不改原数组）
export function sortJobs(
  jobs: JobApplication[],
  sortBy: TrackerSortBy,
  sortDir: TrackerSortDir,
): JobApplication[] {
  const dir = sortDir === 'asc' ? 1 : -1

  if (sortBy === 'company') {
    const collator = new Intl.Collator('zh-Hans-CN')

    return [...jobs].sort(
      (a, b) => collator.compare(a.company, b.company) * dir,
    )
  }

  const ranks = jobs.map((job) => {
    if (sortBy === 'days') return { job, rank: getDaysInStage(job) }
    if (sortBy === 'status') {
      const index = APPLICATION_STATUS_ORDER.indexOf(job.status)

      return { job, rank: index < 0 ? APPLICATION_STATUS_ORDER.length : index }
    }

    const time = Date.parse(
      sortBy === 'updated' ? job.updated_at : job.created_at,
    )

    return { job, rank: Number.isNaN(time) ? 0 : time }
  })

  return ranks.sort((a, b) => (a.rank - b.rank) * dir).map(({ job }) => job)
}
