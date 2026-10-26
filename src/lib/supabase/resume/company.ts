import type {
  ApplicationStatus,
  InterviewSubStage,
  JobApplication,
  StageDetail,
  TrackerActivity,
  TrackerContact,
} from '@/pages/tracker/types'
import { normalizeJobWorkflow } from '@/pages/tracker/workflow'
import supabase from '../client'
import { getCurrentUser } from '../user'

export interface JobApplicationSummary {
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
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  // 转换 JSON 字段为数组
  return (data || []).map((item) =>
    normalizeJobWorkflow({
      ...item,
      stage_details: (item.stage_details || []) as StageDetail[],
      interview_sub_stages: (item.interview_sub_stages ||
        []) as InterviewSubStage[],
      archived: item.archived ?? false,
      jd_text: item.jd_text ?? null,
      jd_updated_at: item.jd_updated_at ?? null,
      source: item.source ?? null,
      next_action: item.next_action ?? null,
      next_action_date: item.next_action_date ?? null,
      activities: (item.activities || []) as TrackerActivity[],
      contacts: (item.contacts || []) as TrackerContact[],
    }),
  )
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
      'id,resume_id,status,updated_at,company,position,archived,next_action_date,next_action,interview_sub_stages',
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
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
  jobData: Omit<JobApplication, 'id' | 'created_at' | 'updated_at' | 'user_id'>,
  assertUser?: CompanyRequestGuard,
): Promise<JobApplication> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('company')
    .insert({
      user_id: user.id,
      ...normalizeJobWorkflow(jobData),
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return normalizeJobWorkflow({
    ...data,
    stage_details: (data.stage_details || []) as StageDetail[],
    interview_sub_stages: (data.interview_sub_stages ||
      []) as InterviewSubStage[],
    archived: data.archived ?? false,
    jd_text: data.jd_text ?? null,
    jd_updated_at: data.jd_updated_at ?? null,
    source: data.source ?? null,
    next_action: data.next_action ?? null,
    next_action_date: data.next_action_date ?? null,
    activities: (data.activities || []) as TrackerActivity[],
    contacts: (data.contacts || []) as TrackerContact[],
  })
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

  const { data, error } = await supabase
    .from('company')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return normalizeJobWorkflow({
    ...data,
    stage_details: (data.stage_details || []) as StageDetail[],
    interview_sub_stages: (data.interview_sub_stages ||
      []) as InterviewSubStage[],
    archived: data.archived ?? false,
    jd_text: data.jd_text ?? null,
    jd_updated_at: data.jd_updated_at ?? null,
    source: data.source ?? null,
    next_action: data.next_action ?? null,
    next_action_date: data.next_action_date ?? null,
    activities: (data.activities || []) as TrackerActivity[],
    contacts: (data.contacts || []) as TrackerContact[],
  })
}

// 更新状态
export async function updateCompanyStatus(
  id: string,
  status: ApplicationStatus,
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { error } = await supabase
    .from('company')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }
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
    throw error
  }
}
