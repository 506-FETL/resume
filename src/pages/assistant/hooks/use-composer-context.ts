import { useEffect, useState } from 'react'
import { listAccessibleResumes } from '@/lib/resume-access'
import { listAssistantJobOverviews } from '@/lib/supabase/resume'
import useUserStore from '@/store/user'
import type {
  ComposerContextResult,
  ComposerJobReference,
  ComposerReferenceState,
  ComposerResumeReference,
} from '../types'
import { useCanvasResources } from './canvas-resources'

export function useComposerContext(): ComposerContextResult {
  const [resumes, setResumes] = useState<
    ComposerReferenceState<ComposerResumeReference>
  >({ generation: -1, items: [], status: 'idle' })

  const [jobs, setJobs] = useState<
    ComposerReferenceState<ComposerJobReference>
  >({ generation: -1, items: [], status: 'idle' })

  const [resumeRetry, setResumeRetry] = useState(0)
  const [jobRetry, setJobRetry] = useState(0)
  const authStatus = useUserStore((state) => state.authStatus)
  const generation = useCanvasResources((state) => state.generation)
  const resumeRevision = useCanvasResources((state) => state.resumeRevision)
  const boardRevision = useCanvasResources((state) => state.boardRevision)

  useEffect(() => {
    if (authStatus === 'unknown') return

    let alive = true

    setResumes((current) => ({
      generation,
      items: current.generation === generation ? current.items : [],
      status: 'loading',
    }))

    listAccessibleResumes(20)
      .then((rows) => {
        if (!alive || generation !== useCanvasResources.getState().generation)
          return

        setResumes({
          generation,
          status: 'ready',
          items: rows.map((resume) => ({
            resumeId: resume.resume_id,
            name: resume.display_name ?? '未命名简历',
          })),
        })
      })
      .catch(() => {
        if (!alive || generation !== useCanvasResources.getState().generation)
          return

        setResumes((current) => ({ ...current, status: 'error' }))
      })

    return () => {
      alive = false
    }
  }, [authStatus, generation, resumeRevision, resumeRetry])

  useEffect(() => {
    if (authStatus === 'unknown') return

    let alive = true

    setJobs((current) => ({
      generation,
      items: current.generation === generation ? current.items : [],
      status: 'loading',
    }))

    listAssistantJobOverviews(20)
      .then((rows) => {
        if (!alive || generation !== useCanvasResources.getState().generation)
          return

        setJobs({
          generation,
          status: 'ready',
          items: rows.map((job) => ({
            id: job.id,
            company: job.company,
            position: job.position,
          })),
        })
      })
      .catch(() => {
        if (!alive || generation !== useCanvasResources.getState().generation)
          return

        setJobs((current) => ({ ...current, status: 'error' }))
      })

    return () => {
      alive = false
    }
  }, [authStatus, generation, boardRevision, jobRetry])

  const pendingStatus = authStatus === 'unknown' ? 'idle' : 'loading'

  return {
    resumes:
      resumes.generation === generation && authStatus !== 'unknown'
        ? resumes
        : { generation, items: [], status: pendingStatus },
    jobs:
      jobs.generation === generation && authStatus !== 'unknown'
        ? jobs
        : { generation, items: [], status: pendingStatus },
    retryResumes: () => setResumeRetry((current) => current + 1),
    retryJobs: () => setJobRetry((current) => current + 1),
  }
}
