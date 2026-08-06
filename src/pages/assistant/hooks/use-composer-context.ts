import { useEffect, useState } from 'react'
import { getAllResumesFromUser, getCompanies } from '@/lib/supabase/resume'

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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const rows = (await getAllResumesFromUser()) as Array<Record<string, unknown>> | null
        if (alive && rows) {
          setResumes(
            rows.slice(0, 20).map(r => ({
              resumeId: String(r.resume_id ?? ''),
              name: String(r.display_name ?? '未命名简历'),
            })),
          )
        }
      }
      catch {
        // 概况拉取失败时静默降级
      }
      try {
        const companies = await getCompanies()
        if (alive) {
          setJobs(
            companies.slice(0, 20).map(j => ({
              id: String(j.id),
              company: j.company ?? '未知公司',
              position: j.position ?? '未知岗位',
            })),
          )
        }
      }
      catch {
        // 概况拉取失败时静默降级
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return { resumes, jobs }
}
