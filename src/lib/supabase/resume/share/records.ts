import { parseSharedTemplateDefinition } from '@/lib/resume-template/share'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import supabase from '../../client'
import { getCurrentUser } from '../../user'
import { readShareVersionSource } from '../share-version'
import type {
  ResumeShareRecord,
  ResumeShareReleaseSummary,
  ResumeShareReviewPayload,
  ResumeShareReviewRelease,
} from '../share.types'

export const SHARE_SELECT = `
  id,
  resume_id,
  user_id,
  token,
  label,
  is_active,
  has_password,
  expires_at,
  view_count,
  last_viewed_at,
  created_at,
  updated_at,
  current_release_id,
  allow_comments,
  purpose,
  show_phone,
  show_email,
  archived_at,
  version_id,
  version:resume_config_versions!resume_shares_version_id_fkey(
    id,
    document_revision,
    status
  ),
  current_release:resume_share_releases!resume_shares_current_release_id_fkey(
    id,
    release_no,
    display_name,
    source_kind,
    source_version_id,
    source_version_no,
    source_version_label,
    source_version_created_at,
    created_at
  )
`

export function toReleaseSummary(value: unknown): ResumeShareReleaseSummary {
  const row = (Array.isArray(value) ? value[0] : value) as Record<
    string,
    any
  > | null

  if (!row?.id || !Number.isInteger(row.release_no)) {
    throw new Error('分享链接缺少当前发布批次')
  }

  return {
    id: row.id,
    releaseNo: row.release_no,
    displayName: row.display_name ?? null,
    source: readShareVersionSource({
      source_kind: row.source_kind,
      source_version_id: row.source_version_id,
      source_version_no: row.source_version_no,
      source_version_label: row.source_version_label,
      source_version_created_at: row.source_version_created_at,
    }),
    createdAt: row.created_at,
  }
}

export function toRecord(row: Record<string, any>): ResumeShareRecord {
  const {
    current_release_id,
    current_release,
    allow_comments,
    purpose,
    show_phone,
    show_email,
    archived_at,
    version_id,
    version,
    ...record
  } = row

  const currentRelease = toReleaseSummary(current_release)

  const currentVersion = (
    Array.isArray(version) ? version[0] : version
  ) as Record<string, any> | null

  if (current_release_id !== currentRelease.id) {
    throw new Error('分享链接当前发布批次不一致')
  }
  if (
    !currentVersion ||
    !Number.isSafeInteger(version_id) ||
    currentVersion.id !== version_id
  ) {
    throw new Error('分享链接缺少有效版本')
  }

  return {
    ...record,
    display_name: currentRelease.displayName,
    currentReleaseId: current_release_id,
    currentRelease,
    versionId: version_id,
    documentRevision: Number(currentVersion.document_revision ?? 1),
    allowComments: allow_comments,
    purpose: purpose ?? null,
    showPhone: show_phone !== false,
    showEmail: show_email !== false,
    archivedAt: archived_at ?? null,
    source: currentRelease.source,
  } as ResumeShareRecord
}

export async function getResumeShareRecord(
  shareId: string,
  signal?: AbortSignal,
): Promise<ResumeShareRecord> {
  const query = supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('id', shareId)

  const { data, error } = await (
    signal ? query.abortSignal(signal) : query
  ).single()

  if (error) throw error

  return toRecord(data)
}

/** 列出某简历的所有分享链接（owner） */
export async function listResumeShares(
  resumeId: string,
): Promise<ResumeShareRecord[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('user_id', user.id)
    .eq('resume_id', resumeId)
    .not('current_release_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(toRecord)
}

export async function listAllResumeShares(): Promise<ResumeShareRecord[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('user_id', user.id)
    .not('current_release_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(toRecord)
}

export async function listResumeShareReviewReleases(
  resumeId: string,
): Promise<ResumeShareReviewRelease[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('resume_share_releases')
    .select(
      `
      id,
      share_id,
      release_no,
      display_name,
      created_at,
      share:resume_shares!inner(
        id,
        resume_id,
        user_id,
        label,
        archived_at,
        current_release_id
      )
    `,
    )
    .eq('share.resume_id', resumeId)
    .eq('share.user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: Record<string, any>) => {
    const share = (
      Array.isArray(row.share) ? row.share[0] : row.share
    ) as Record<string, any>

    return {
      id: row.id,
      shareId: row.share_id,
      releaseNo: row.release_no,
      shareLabel: share?.label ?? null,
      displayName: row.display_name ?? null,
      archivedAt: share?.archived_at ?? null,
      isCurrent: share?.current_release_id === row.id,
      createdAt: row.created_at,
    }
  })
}

export async function getResumeShareReleaseForReview(
  releaseId: string,
): Promise<ResumeShareReviewPayload> {
  const { data, error } = await supabase
    .from('resume_share_releases')
    .select('snapshot,template_manifest,display_name')
    .eq('id', releaseId)
    .single()

  if (error) throw error

  return {
    snapshot: data.snapshot as PersistedResumeSnapshot,
    templateDefinition: parseSharedTemplateDefinition(data.template_manifest),
    displayName: data.display_name ?? null,
  }
}
