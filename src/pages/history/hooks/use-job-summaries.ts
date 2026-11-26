import { useEffect } from 'react'
import useHistoryStore from '../store'
import { useJobOptions } from '../store/options'

export function historyJobLabel(job: { company: string; position: string }) {
  return [job.company, job.position].filter(Boolean).join(' · ') || '未命名岗位'
}

export function useJobSummaries(companyId: string | null) {
  const cached = useJobOptions((state) =>
    companyId ? state.items.find((job) => job.id === companyId) : undefined,
  )

  const resource = useHistoryStore((state) =>
    companyId ? state.jobOptions[companyId] : undefined,
  )

  const load = useHistoryStore((state) => state.loadJobOptions)

  useEffect(() => {
    if (companyId && !cached && !resource) load(companyId)
  }, [companyId, cached, resource, load])

  const job = cached ?? resource?.items[0]

  return {
    options: job ? [{ id: job.id, label: historyJobLabel(job) }] : [],
    loading: Boolean(companyId && !cached && (!resource || resource.loading)),
    error: cached ? null : (resource?.error ?? null),
    retry: () => {
      if (companyId) return load(companyId)
    },
  }
}
