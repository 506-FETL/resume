import { useEffect, useState } from 'react'
import { listAccessibleResumes } from '@/lib/resume-access'
import { listAssistantJobOverviews } from '@/lib/supabase/resume'
import { useCanvasResources } from './canvas-resources'

export interface ResumeRef {
  resumeId: string
  name: string
}

export interface JobRef {
  id: string
  company: string
  position: string
}

// 加载可供 @ 引用的简历与职位，用于 Composer 的 contextOptions
export function useComposerContext() {
  const [resumes, setResumes] = useState<ResumeRef[]>([])
  const [jobs, setJobs] = useState<JobRef[]>([])
  const [resumesGeneration, setResumesGeneration] = useState(-1)
  const [jobsGeneration, setJobsGeneration] = useState(-1)

  const { generation, resumeRevision, boardRevision } = useCanvasResources()

  useEffect(() => {
    let alive = true

    setResumes([])

    listAccessibleResumes(20)
      .then((rows) => {
        if (!alive || generation !== useCanvasResources.getState().generation)
          return

        setResumesGeneration(generation)

        setResumes(
          rows.map((resume) => ({
            resumeId: resume.resume_id,
            name: resume.display_name ?? '未命名简历',
          })),
        )
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
  }, [generation, resumeRevision])

  useEffect(() => {
    let alive = true

    setJobs([])

    listAssistantJobOverviews(20)
      .then((rows) => {
        if (!alive || generation !== useCanvasResources.getState().generation)
          return

        setJobsGeneration(generation)

        setJobs(
          rows.map((job) => ({
            id: job.id,
            company: job.company,
            position: job.position,
          })),
        )
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
  }, [generation, boardRevision])

  return {
    resumes: resumesGeneration === generation ? resumes : [],
    jobs: jobsGeneration === generation ? jobs : [],
  }
}
