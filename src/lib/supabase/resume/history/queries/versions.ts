import supabase from '../../../client'
import { collectPages } from '../../../pagination'
import { getCurrentUser } from '../../../user'
import type {
  ResumeHistoryShareReleaseRow,
  ResumeHistoryVersionListRow,
  ResumeHistoryVersionRow,
  ResumeHistoryVersionSummaryRecord,
  ResumeSnapshot,
  ResumeVersionListItem,
} from '../types'
import {
  VERSION_LIST_SELECTOR,
  VERSION_SELECTOR,
  VERSION_SHARE_RELEASE_SELECTOR,
  VERSION_SUMMARY_SELECTOR,
} from './selectors'

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
      .eq('status', 'frozen')
      .order('version_no', { ascending: false })
      .range(from, to)

    if (error) throw error

    return (data ?? []) as ResumeHistoryVersionListRow[]
  })
}

export async function listResumeVersions(
  resumeId: string,
): Promise<ResumeVersionListItem[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const [versions, shares] = await Promise.all([
    collectPages(async (from, to) => {
      const { data, error } = await supabase
        .from('resume_config_versions')
        .select(VERSION_LIST_SELECTOR)
        .eq('resume_id', resumeId)
        .eq('user_id', user.id)
        .order('status', { ascending: true })
        .order('version_no', { ascending: false })
        .range(from, to)

      if (error) throw error

      return (data ?? []) as ResumeHistoryVersionListRow[]
    }),
    collectPages(async (from, to) => {
      const { data, error } = await supabase
        .from('resume_shares')
        .select('version_id')
        .eq('resume_id', resumeId)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .range(from, to)

      if (error) throw error

      return (data ?? []) as Array<{ version_id: number | null }>
    }),
  ])

  const sharedCounts = new Map<number, number>()

  for (const share of shares) {
    if (share.version_id == null) continue

    sharedCounts.set(
      share.version_id,
      (sharedCounts.get(share.version_id) ?? 0) + 1,
    )
  }

  return versions.map((version) => ({
    ...version,
    shared_link_count: sharedCounts.get(version.id) ?? 0,
  }))
}

export async function getCurrentResumeVersion(resumeId: string) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(VERSION_SELECTOR)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (error) throw error

  return data as ResumeHistoryVersionRow
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
