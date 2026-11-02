import type {
  ApplicationStatus,
  InterviewSubStage,
  JobApplication,
  StageDetail,
  TrackerActivity,
  TrackerContact,
  ReopenProcessInput,
} from '@/pages/tracker/types'
import { normalizeJobWorkflow } from '@/pages/tracker/workflow'
import supabase from '../client'
import { collectPages } from '../pagination'
import { getCurrentUser } from '../user'
import { trackerProcessError } from './tracker-companies'

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
type CompanyRequestGuard = (userId: string | null) => void

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

// 创建新公司/职位
export async function createCompany(
  jobData: Omit<
    JobApplication,
    | 'id'
    | 'created_at'
    | 'updated_at'
    | 'user_id'
    | 'tracker_company_id'
    | 'focused_at'
  > & { tracker_company_id: string | null },
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase.rpc('create_tracker_process', {
    p_job: normalizeJobWorkflow(jobData),
  })

  if (error) {
    throw trackerProcessError(error)
  }

  return normalizeJobWorkflow(data)
}

// 更新公司/职位
export async function updateCompany(
  id: string,
  updates: Partial<Omit<JobApplication, 'id' | 'created_at' | 'user_id'>>,
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } =
    'status' in updates
      ? await supabase.rpc('transition_tracker_process', {
          p_job_id: id,
          p_patch: updates,
        })
      : await supabase
          .from('company')
          .update(updates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

  if (error) {
    throw trackerProcessError(error)
  }

  return normalizeJobWorkflow(data)
}

// 归档/取消归档（复用 updateCompany 的落库与映射逻辑）
export async function archiveCompany(
  id: string,
  archived: boolean,
): Promise<JobApplication> {
  return updateCompany(id, { archived })
}

// 追加一条活动记录（在既有 activities 基础上 append，复用 updateCompany）
export async function addActivity(
  id: string,
  existing: TrackerActivity[],
  activity: TrackerActivity,
): Promise<JobApplication> {
  return updateCompany(id, { activities: [...existing, activity] })
}

// 删除公司/职位
export async function deleteCompany(
  id: string,
  assertUser?: CompanyRequestGuard,
) {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { error } = await supabase
    .from('company')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    throw trackerProcessError(error)
  }
}

export async function reassignTrackerProcess(
  jobId: string,
  companyId: string,
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('请先登录')

  const { data, error } = await supabase.rpc('reassign_tracker_process', {
    p_job_id: jobId,
    p_company_id: companyId,
  })

  assertUser?.(user.id)

  if (error) throw trackerProcessError(error)

  return normalizeJobWorkflow(data)
}

export async function reopenTrackerProcess(
  input: ReopenProcessInput,
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('请先登录')

  const { data, error } = await supabase.rpc('reopen_tracker_process', {
    p_job_id: input.jobId,
    p_event_id: input.eventId,
    p_target: input.target,
    p_date: input.date,
    p_reason: input.reason,
  })

  assertUser?.(user.id)

  if (error) throw trackerProcessError(error)

  return normalizeJobWorkflow(data)
}
