import { useEffect, useMemo } from 'react'
import useHistoryStore from '../store'

export function useJobSummaries(companyId?: string | null) {
  const resource = useHistoryStore((state) => {
    if (companyId === null) return undefined

    const all = state.jobOptions.all

    if (all && !all.loading && !all.error) return all

    return (
      state.jobOptions[companyId ?? 'all'] ?? (all?.loading ? all : undefined)
    )
  })

  const load = useHistoryStore((state) => state.loadJobOptions)

  useEffect(() => {
    if (companyId !== null && !resource) load(companyId)
  }, [companyId, resource, load])

  const options = useMemo(() => {
    const jobs = resource?.items ?? []
    const rows = companyId ? jobs.filter((job) => job.id === companyId) : jobs

    return rows.map((job) => ({
      id: job.id,
      label:
        [job.company, job.position].filter(Boolean).join(' · ') || '未命名岗位',
    }))
  }, [resource?.items, companyId])

  return {
    options,
    loading: companyId !== null && (!resource || resource.loading),
    error: resource?.error ?? null,
    retry: () => {
      if (companyId !== null) return load(companyId)
    },
  }
}
