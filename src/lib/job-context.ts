import type { ResumeType } from '@/lib/schema'
import { create } from 'zustand'
import supabase from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/user'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '@/pages/tracker/lib/account-scope'
import { updateCompany } from '@/lib/supabase/resume/company'

export interface JobContext {
  id: string
  userId: string
  company: string
  position: string
  jdText: string
  resumeId: string | null
  resumeType: ResumeType | null
  resumeName: string | null
}

export function jobContextUrl(
  path: string,
  jobId: string,
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams({ jobId, ...extra })

  return `${path}?${params.toString()}`
}

export async function readJobContext(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobContext> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  )
    throw new Error('岗位地址无效')

  const scope = getTrackerAccountScope()
  const user = await getCurrentUser()

  createTrackerAccountGuard(scope)(user?.id ?? null)

  const query = supabase
    .from('company')
    .select('id,user_id,company,position,jd_text,resume_id')
    .eq('id', jobId)
    .eq('user_id', user!.id)

  const { data: job, error } = await (
    signal ? query.abortSignal(signal) : query
  ).single()

  assertTrackerAccountScope(scope)

  if (error || !job) throw new Error('岗位不存在或你没有访问权限')

  let resume: { type: ResumeType; display_name: string | null } | null = null

  if (job.resume_id) {
    const resumeQuery = supabase
      .from('resume_config')
      .select('type,display_name')
      .eq('resume_id', job.resume_id)
      .eq('user_id', user!.id)

    const result = await (
      signal ? resumeQuery.abortSignal(signal) : resumeQuery
    ).single()

    assertTrackerAccountScope(scope)

    if (result.error || !result.data)
      throw new Error('准备中的简历不可用，请返回岗位重新选择')

    resume = result.data as { type: ResumeType; display_name: string | null }
  }

  return {
    id: job.id,
    userId: user!.id,
    company: job.company,
    position: job.position,
    jdText: job.jd_text ?? '',
    resumeId: job.resume_id,
    resumeType: resume?.type ?? null,
    resumeName: resume?.display_name ?? null,
  }
}

export async function bindJobResume(jobId: string, resumeId: string) {
  const scope = getTrackerAccountScope()
  const job = await readJobContext(jobId)

  const { data, error } = await supabase
    .from('resume_config')
    .select('resume_id')
    .eq('resume_id', resumeId)
    .eq('user_id', job.userId)
    .single()

  assertTrackerAccountScope(scope)

  if (error || !data) throw new Error('只能关联自己的云端简历')

  await updateCompany(
    jobId,
    { resume_id: resumeId },
    createTrackerAccountGuard(scope),
  )

  assertTrackerAccountScope(scope)

  return readJobContext(jobId)
}

export const useJobContextStore = create<{
  context: JobContext | null
  setContext: (context: JobContext | null) => void
}>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}))
