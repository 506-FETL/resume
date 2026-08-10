import type { JobApplicationSummary } from '@/lib/supabase/resume'
import { useEffect, useState } from 'react'
import { listJobApplicationSummaries } from '@/lib/supabase/resume'

export interface JobOption {
  id: string
  label: string // 「公司 · 职位」
}

/** 拉取当前用户的岗位列表，供版本关联岗位选择器使用；组件级一次性加载。 */
export function useJobSummaries() {
  const [jobs, setJobs] = useState<JobApplicationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listJobApplicationSummaries()
      .then((rows) => {
        if (!cancelled)
          setJobs(rows)
      })
      .catch(() => {
        if (!cancelled)
          setJobs([])
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const options: JobOption[] = jobs.map(job => ({
    id: job.id,
    label: [job.company, job.position].filter(Boolean).join(' · ') || '未命名岗位',
  }))

  const getLabel = (companyId: string | null | undefined): string | null => {
    if (!companyId)
      return null
    return options.find(option => option.id === companyId)?.label ?? null
  }

  return { options, getLabel, loading }
}
