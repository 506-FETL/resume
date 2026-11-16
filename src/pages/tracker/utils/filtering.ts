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

  const time = (value: string) => {
    const t = new Date(value).getTime()

    return Number.isNaN(t) ? 0 : t
  }

  // rejected 不在 APPLICATION_STATUS_ORDER 中，按“走完全部阶段之后”排到末尾
  const statusRank = (status: ApplicationStatus) => {
    const idx = APPLICATION_STATUS_ORDER.indexOf(status)

    return idx === -1 ? APPLICATION_STATUS_ORDER.length : idx
  }

  return [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return (time(a.updated_at) - time(b.updated_at)) * dir
      case 'created':
        return (time(a.created_at) - time(b.created_at)) * dir
      case 'days':
        return (getDaysInStage(a) - getDaysInStage(b)) * dir
      case 'company':
        return a.company.localeCompare(b.company, 'zh-Hans-CN') * dir
      case 'status':
        return (statusRank(a.status) - statusRank(b.status)) * dir
      default:
        return 0
    }
  })
}
