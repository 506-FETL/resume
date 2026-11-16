import type {
  ApplicationStatus,
  InterviewSubStage,
  JobApplication,
  StageDetail,
  TrackerActivity,
  TrackerContact,
} from '@/pages/tracker/types'
import { normalizeJobWorkflow } from '@/pages/tracker/workflow'
import supabase from '../../client'
import { collectPages } from '../../pagination'
import { getCurrentUser } from '../../user'
import { trackerProcessError } from '../tracker-companies'

export interface JobApplicationSummary {
  focused_at: string | null
  id: string
  resume_id: string | null
  status: ApplicationStatus
  updated_at: string
  company: string
  position: string
  archived: boolean
  next_action_date: string | null
  next_action: string | null
  interview_sub_stages: InterviewSubStage[]
}

// 获取用户所有公司/职位
export type CompanyRequestGuard = (userId: string | null) => void

export async function getCompanies(
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication[]> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('company')
    .select('*,job_submissions(is_primary)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw trackerProcessError(error)
  }

  return (data ?? []).map(({ job_submissions, ...row }) =>
    normalizeJobWorkflow({
      ...row,
      stage_details: row.stage_details as StageDetail[],
      interview_sub_stages: (row.interview_sub_stages ??
        []) as InterviewSubStage[],
      activities: row.activities as TrackerActivity[],
      contacts: row.contacts as TrackerContact[],
      has_submission: job_submissions.some(
        (record: { is_primary: boolean }) => record.is_primary,
      ),
      unresolved_submissions:
        job_submissions.length > 0 &&
        !job_submissions.some(
          (record: { is_primary: boolean }) => record.is_primary,
        ),
    }),
  )
}

export type AssistantJobSummary = Pick<
  JobApplication,
  | 'id'
  | 'company'
  | 'position'
  | 'status'
  | 'location'
  | 'salary'
  | 'next_action'
  | 'archived'
>

export async function listAssistantJobs(
  assertUser?: CompanyRequestGuard,
): Promise<AssistantJobSummary[]> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  return collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from('company')
      .select('id,company,position,status,location,salary,next_action,archived')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw trackerProcessError(error)

    return data ?? []
  })
}

export type AssistantJobOverview = Pick<
  AssistantJobSummary,
  'id' | 'company' | 'position' | 'status'
>

export async function listAssistantJobOverviews(
  limit?: number,
): Promise<AssistantJobOverview[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const fetchPage = async (from: number, to: number) => {
    const { data, error } = await supabase
      .from('company')
      .select('id,company,position,status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw trackerProcessError(error)

    return data ?? []
  }

  return limit === undefined ? collectPages(fetchPage) : fetchPage(0, limit - 1)
}

export async function getCompanyById(
  id: string,
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication | null> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('company')
    .select('*,job_submissions(is_primary)')
    .eq('user_id', user.id)
    .eq('id', id)
    .maybeSingle()

  if (error) throw trackerProcessError(error)
  if (!data) return null

  const { job_submissions, ...row } = data

  return normalizeJobWorkflow({
    ...row,
    has_submission: job_submissions.some(
      (record: { is_primary: boolean }) => record.is_primary,
    ),
    unresolved_submissions:
      job_submissions.length > 0 &&
      !job_submissions.some(
        (record: { is_primary: boolean }) => record.is_primary,
      ),
  } as JobApplication)
}

export type JobApplicationProgress = Pick<
  JobApplication,
  | 'status'
  | 'stage_details'
  | 'interview_sub_stages'
  | 'activities'
  | 'updated_at'
  | 'has_submission'
  | 'unresolved_submissions'
>

export async function getCompanyProgressById(
  id: string,
  assertUser?: CompanyRequestGuard,
): Promise<JobApplicationProgress | null> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('company')
    .select(
      'status,stage_details,interview_sub_stages,activities,updated_at,job_submissions(is_primary)',
    )
    .eq('user_id', user.id)
    .eq('id', id)
    .maybeSingle()

  assertUser?.(user.id)

  if (error) throw trackerProcessError(error)
  if (!data) return null

  const { job_submissions, ...progress } = data
  const hasSubmission = job_submissions.some((record) => record.is_primary)

  return {
    ...progress,
    has_submission: hasSubmission,
    unresolved_submissions: job_submissions.length > 0 && !hasSubmission,
  } as JobApplicationProgress
}

export async function getCompanySummaryById(
  id: string,
  assertUser?: CompanyRequestGuard,
) {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('company')
    .select('id,company,position,location')
    .eq('user_id', user.id)
    .eq('id', id)
    .maybeSingle()

  if (error) throw trackerProcessError(error)

  return data
}

export type JobOptionSummary = Pick<
  JobApplication,
  'id' | 'company' | 'position'
>

export async function listJobOptions(): Promise<JobOptionSummary[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  return collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from('company')
      .select('id,company,position')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw trackerProcessError(error)

    return data ?? []
  })
}

export async function listJobApplicationSummaries(): Promise<
  JobApplicationSummary[]
> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('company')
    .select(
      'id,resume_id,status,updated_at,company,position,archived,focused_at,next_action_date,next_action,interview_sub_stages',
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    throw trackerProcessError(error)
  }

  return (data ?? []).map((item) => ({
    ...item,
    archived: item.archived ?? false,
    next_action_date: item.next_action_date ?? null,
    next_action: item.next_action ?? null,
    interview_sub_stages: item.interview_sub_stages ?? [],
  })) as JobApplicationSummary[]
}
