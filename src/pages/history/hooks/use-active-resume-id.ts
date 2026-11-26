import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isCloudResumeId } from '@/lib/resume-id'
import { prepareHistoryTarget } from '@/lib/history-route'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import useHistoryStore from '../store'
import { useResumeOptions } from '../store/options'

export function useActiveHistoryResumeId() {
  const owner = useUserStore((state) => state.currentUser?.id)
  const currentId = useCurrentResumeStore((state) => state.resumeId)
  const id = isCloudResumeId(currentId) ? currentId : null
  const [params] = useSearchParams()
  const jobId = params.get('jobId') || null

  const missing = useHistoryStore(
    (state) => state.resumeId === id && state.currentResumeMissing,
  )

  const activeResumeId = missing ? null : id
  const hasOptions = useResumeOptions((state) => state.items.length > 0)
  const ready = useResumeOptions((state) => state.ready)
  const error = useResumeOptions((state) => state.error)
  const load = useResumeOptions((state) => state.load)

  useEffect(() => {
    if (owner) prepareHistoryTarget(owner, jobId, id)
  }, [owner, jobId, id])

  useEffect(() => {
    if (owner && !activeResumeId && !ready && !error && !hasOptions)
      load(owner, 'probe')
  }, [owner, activeResumeId, ready, error, hasOptions, load])

  return {
    activeResumeId,
    hasOptions,
    loading: !activeResumeId && !ready && !hasOptions && !error,
    error: hasOptions ? null : error,
    reload: () => owner && load(owner, 'probe'),
  }
}
