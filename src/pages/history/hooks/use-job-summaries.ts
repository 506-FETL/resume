import { useEffect } from 'react'
import useHistoryStore from '../store'

export interface JobOption {
  id: string
  label: string // 「公司 · 职位」
}

export function useJobSummaries() {
  const jobs = useHistoryStore((state) => state.jobOptions)
  const loading = useHistoryStore((state) => state.jobOptionsLoading)
  const error = useHistoryStore((state) => state.jobOptionsError)
  const generation = useHistoryStore((state) => state.jobOptionsGeneration)
  const load = useHistoryStore((state) => state.loadJobOptions)

  useEffect(() => {
    load()
  }, [load, generation])

  const options: JobOption[] = jobs.map((job) => ({
    id: job.id,
    label:
      [job.company, job.position].filter(Boolean).join(' · ') || '未命名岗位',
  }))

  const getLabel = (companyId: string | null | undefined): string | null => {
    if (!companyId) return null

    return options.find((option) => option.id === companyId)?.label ?? null
  }

  return { options, getLabel, loading, error, retry: load }
}
