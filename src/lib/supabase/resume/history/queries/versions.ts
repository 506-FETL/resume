import supabase from '../../../client'
import { collectPages } from '../../../pagination'
import { getCurrentUser } from '../../../user'
import type {
  ResumeHistoryShareReleaseRow,
  ResumeHistoryVersionRow,
  ResumeHistoryVersionSummaryRecord,
  ResumeSnapshot,
  ResumeVersionListItem,
} from '../types'
import {
  VERSION_SHARE_RELEASE_SELECTOR,
  VERSION_SUMMARY_SELECTOR,
} from './selectors'

export async function getFrozenVersionForRestore(
  resumeId: string,
  versionId: number,
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select('version_no,version_name,milestone_name,tags')
    .eq('id', versionId)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .eq('status', 'frozen')
    .maybeSingle()

  if (error) throw error

  return data
}

export async function listResumeVersions(
  resumeId: string,
): Promise<ResumeVersionListItem[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  return collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from('resume_config_versions')
      .select(
        'id,status,version_no,version_name,milestone_name,projection_reference_date',
      )
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('status', { ascending: true })
      .order('version_no', { ascending: false })
      .range(from, to)

    if (error) throw error

    return (data ?? []) as ResumeVersionListItem[]
  })
}

export async function getCurrentResumeVersion(resumeId: string) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select('id,snapshot,document_revision,projection_reference_date')
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (error) throw error

  return data as Pick<
    ResumeHistoryVersionRow,
    'id' | 'snapshot' | 'document_revision' | 'projection_reference_date'
  >
}

export async function getResumeHistoryVersionForShare(
  resumeId: string,
  versionId: number,
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(VERSION_SHARE_RELEASE_SELECTOR)
    .eq('id', versionId)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (error) throw error

  return data as ResumeHistoryShareReleaseRow
}

export async function getResumeVersionForShare(
  resumeId: string,
  versionId: number,
) {
  return getResumeHistoryVersionForShare(resumeId, versionId)
}

export async function getResumeHistoryVersionSnapshot(
  id: number,
  resumeId?: string,
) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  let query = supabase
    .from('resume_config_versions')
    .select('snapshot')
    .eq('id', id)
    .eq('user_id', user.id)

  if (resumeId) query = query.eq('resume_id', resumeId).eq('status', 'frozen')

  const { data, error } = await query.single()

  if (error) {
    throw error
  }

  return (data as { snapshot: ResumeSnapshot | Record<string, unknown> })
    .snapshot
}

export async function listResumeHistoryVersionSummaries(resumeId?: string) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  return collectPages(async (from, to) => {
    let query = supabase
      .from('resume_config_versions')
      .select(VERSION_SUMMARY_SELECTOR)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (resumeId) query = query.eq('resume_id', resumeId)

    const { data, error } = await query

    if (error) throw error

    return (data ?? []) as ResumeHistoryVersionSummaryRecord[]
  })
}
