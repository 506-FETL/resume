import type {
  CreateResumeHistoryVersionInput,
  ResumeHistoryOptionRecord,
  ResumeHistoryResumeRecord,
  ResumeHistoryShareReleaseRow,
  ResumeHistoryVersionListRow,
  ResumeHistoryVersionRow,
  ResumeHistoryVersionSummaryRecord,
  ResumeSnapshot,
  UpdateResumeHistoryVersionInput,
} from './types'
import supabase from '../../client'
import { collectPages } from '../../pagination'
import { getCurrentUser } from '../../user'
import { getResumeById } from '../form'

const VERSION_SELECTOR = `
  id,
  created_at,
  updated_at,
  user_id,
  resume_id,
  version_no,
  version_name,
  description,
  milestone_name,
  source_type,
  tags,
  snapshot,
  content_hash,
  base_updated_at,
  company_id,
  submitted_at
`

// 列表用：不含 snapshot（侧边栏渲染用不到），大幅减小载荷
const VERSION_LIST_SELECTOR = `
  id,
  created_at,
  updated_at,
  user_id,
  resume_id,
  version_no,
  version_name,
  description,
  milestone_name,
  source_type,
  tags,
  content_hash,
  base_updated_at,
  company_id,
  submitted_at
`

const RESUME_SELECTOR = `
  resume_id,
  updated_at,
  display_name,
  description,
  type,
  basics,
  job_intent,
  application_info,
  edu_background,
  work_experience,
  internship_experience,
  campus_experience,
  project_experience,
  skill_specialty,
  honors_certificates,
  self_evaluation,
  hobbies,
  order,
  visibility,
  spacing,
  font,
  theme
`

const RESUME_OPTION_SELECTOR = `
  resume_id,
  updated_at,
  display_name,
  description,
  type
`

const VERSION_SUMMARY_SELECTOR = `
  resume_id,
  version_no,
  created_at,
  source_type,
  milestone_name
`

const VERSION_SHARE_RELEASE_SELECTOR = `
  resume_id,
  version_no,
  version_name,
  milestone_name,
  created_at,
  snapshot
`

export async function getResumeHistoryResume(resumeId: string) {
  return getResumeById<ResumeHistoryResumeRecord>(resumeId, RESUME_SELECTOR)
}

export async function listResumeHistoryOptions() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config')
    .select(RESUME_OPTION_SELECTOR)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ResumeHistoryOptionRecord[]
}

export async function listResumeHistoryVersions(resumeId: string) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  return collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from('resume_config_versions')
      .select(VERSION_LIST_SELECTOR)
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('version_no', { ascending: false })
      .range(from, to)

    if (error)
      throw error

    return (data ?? []) as ResumeHistoryVersionListRow[]
  })
}

export async function getResumeHistoryVersionForShare(
  resumeId: string,
  versionId: number,
) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(VERSION_SHARE_RELEASE_SELECTOR)
    .eq('id', versionId)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (error)
    throw error

  return data as ResumeHistoryShareReleaseRow
}

export async function getResumeHistoryVersionSnapshot(id: number) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select('snapshot')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    throw error
  }

  return (data as { snapshot: ResumeSnapshot | Record<string, unknown> }).snapshot
}

export async function listResumeHistoryVersionSummaries() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(VERSION_SUMMARY_SELECTOR)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ResumeHistoryVersionSummaryRecord[]
}

export async function createResumeHistoryVersion(input: CreateResumeHistoryVersionInput) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config_versions')
    .insert({
      resume_id: input.resume_id,
      version_name: input.version_name ?? null,
      description: input.description ?? null,
      milestone_name: input.milestone_name ?? null,
      source_type: input.source_type ?? 'manual',
      tags: input.tags ?? [],
      snapshot: input.snapshot,
      content_hash: input.content_hash ?? null,
      base_updated_at: input.base_updated_at ?? null,
      company_id: input.company_id ?? null,
      submitted_at: input.submitted_at ?? null,
    })
    .select(VERSION_SELECTOR)
    .single()

  if (error) {
    throw error
  }

  return data as ResumeHistoryVersionRow
}

export async function updateResumeHistoryVersion(id: number, input: UpdateResumeHistoryVersionInput) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config_versions')
    .update({
      version_name: input.version_name ?? null,
      description: input.description ?? null,
      milestone_name: input.milestone_name ?? null,
      tags: input.tags ?? [],
      company_id: input.company_id ?? null,
      submitted_at: input.submitted_at ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(VERSION_SELECTOR)
    .single()

  if (error) {
    throw error
  }

  return data as ResumeHistoryVersionRow
}

export async function deleteResumeHistoryVersion(id: number) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { error } = await supabase.rpc('delete_resume_history_version_with_comments', {
    p_history_version_id: id,
  })

  if (error) {
    throw error
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('resume-history-version-deleted', {
      detail: { historyVersionId: id },
    }))
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('resume-history-events')
    channel.postMessage({ type: 'history-version-deleted', historyVersionId: id })
    channel.close()
  }
}
