import type { ResumeType } from '@/lib/schema'
import { create } from 'zustand'
import supabase from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/user'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '@/pages/tracker/lib/account-scope'
import { trackerProcessError } from '@/lib/supabase/resume/tracker-companies'

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

interface JobContextRow {
  id: string
  user_id: string
  company: string
  position: string
  jd_text: string | null
  resume_id: string | null
  resume: { type: ResumeType; display_name: string | null } | null
}

const JOB_CONTEXT_FIELDS =
  'id,user_id,company,position,jd_text,resume_id,resume:resume_config!company_resume_id_fkey(type,display_name)'

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
  assertJobId(jobId)

  const scope = getTrackerAccountScope()
  const user = await getCurrentUser()

  createTrackerAccountGuard(scope)(user?.id ?? null)

  const query = supabase
    .from('company')
    .select(JOB_CONTEXT_FIELDS)
    .eq('id', jobId)
    .eq('user_id', user!.id)
    .eq('resume.user_id', user!.id)

  const { data: job, error } = await (
    signal ? query.abortSignal(signal) : query
  ).single<JobContextRow>()

  assertTrackerAccountScope(scope)

  if (error || !job) throw new Error('岗位不存在或你没有访问权限')

  return toJobContext(job)
}

export async function bindJobResume(jobId: string, resumeId: string) {
  assertJobId(jobId)

  const scope = getTrackerAccountScope()
  const user = await getCurrentUser()

  createTrackerAccountGuard(scope)(user?.id ?? null)

  const { data, error } = await supabase
    .from('resume_config')
    .select('resume_id')
    .eq('resume_id', resumeId)
    .eq('user_id', user!.id)
    .single()

  assertTrackerAccountScope(scope)

  if (error || !data) throw new Error('只能关联自己的云端简历')

  const { data: job, error: updateError } = await supabase
    .from('company')
    .update({ resume_id: resumeId })
    .eq('id', jobId)
    .eq('user_id', user!.id)
    .select(JOB_CONTEXT_FIELDS)
    .eq('resume.user_id', user!.id)
    .single<JobContextRow>()

  assertTrackerAccountScope(scope)

  if (updateError?.code === 'PGRST116' || (!updateError && !job))
    throw new Error('岗位不存在或你没有访问权限')
  if (updateError) throw trackerProcessError(updateError)

  return toJobContext(job!)
}

function assertJobId(jobId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  )
    throw new Error('岗位地址无效')
}

function toJobContext(job: JobContextRow): JobContext {
  if (job.resume_id && !job.resume)
    throw new Error('准备中的简历不可用，请返回岗位重新选择')

  return {
    id: job.id,
    userId: job.user_id,
    company: job.company,
    position: job.position,
    jdText: job.jd_text ?? '',
    resumeId: job.resume_id,
    resumeType: job.resume?.type ?? null,
    resumeName: job.resume?.display_name ?? null,
  }
}

export const useJobContextStore = create<{
  context: JobContext | null
  setContext: (context: JobContext | null) => void
}>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}))
