import { readJobContext } from '@/lib/job-context'
import type {
  CreateShareOptions,
  CurrentResumeShareSnapshotProvider,
  ResolvedResumeShareRelease,
  ResumeShareRecord,
  ResumeShareReleaseSummary,
  ResumeShareReviewPayload,
  ResumeShareReviewRelease,
  ResumeShareSnapshotSource,
  ShareVersionSelection,
} from './share.types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { ResumeHistoryShareReleaseRow } from './history/types'
import { sharePurposeDefaults } from '@/lib/share-purpose'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import {
  isResumeCommentClientError,
  ResumeCommentClient,
} from '@/features/resume-comments/api/client.ts'
import { resolveTemplate } from '@/lib/resume-template/runtime/resolve-template'
import {
  parseSharedTemplateDefinition,
  serializeTemplateForShare,
} from '@/lib/resume-template/share'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import { redactHiddenResumeSections } from '../../../../supabase/functions/shared/resume-share-redaction.ts'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { getResumeById, RESUME_PERSISTED_SELECTOR } from './form'
import {
  createResumeHistoryVersion,
  getCurrentResumeVersion,
  getResumeVersionForShare,
} from './history/queries'
import {
  readShareVersionSource,
  toShareVersionSourcePatch,
} from './share-version'
import { getResumeShareFunctionUrl } from './share-function-url'

const SHARE_SELECT = `
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

const SHARE_PUBLISH_TIMEOUT_MS = 15_000
const sharePublishRequests = new Map<string, Promise<ResumeShareRecord>>()

function toReleaseSummary(value: unknown): ResumeShareReleaseSummary {
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

function toRecord(row: Record<string, any>): ResumeShareRecord {
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

async function getResumeShareRecord(
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

function generateToken() {
  // 64 位十六进制随机串（两段 uuid 去横线拼接），足够长以抵抗枚举
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
}

/** 从云端简历配置构造完整快照（列表卡片场景：页面未加载文档） */
export async function buildResumeShareSnapshotSource(
  snapshot: PersistedResumeSnapshot,
  displayName: string | null,
): Promise<ResumeShareSnapshotSource> {
  const publicSnapshot = redactHiddenResumeSections(snapshot)

  const definition = await resolveTemplate(
    resumeTemplateSource,
    snapshot.templateBinding,
  )

  return {
    snapshot: publicSnapshot,
    templateManifest: serializeTemplateForShare(definition),
    displayName,
  }
}

export async function getResumeSnapshotById(
  resumeId: string,
): Promise<ResumeShareSnapshotSource> {
  const source = await getResumeById<Record<string, unknown>>(
    resumeId,
    `${RESUME_PERSISTED_SELECTOR},display_name`,
  )

  const snapshot = mapSourceToPersistedSnapshot(source ?? {})

  const displayName =
    (source as { display_name?: string | null } | null)?.display_name ?? null

  return buildResumeShareSnapshotSource(snapshot, displayName)
}

export async function resolveResumeShareRelease(input: {
  resumeId: string
  displayName: string | null
  selection: ShareVersionSelection
  getCurrentSource: CurrentResumeShareSnapshotProvider
}): Promise<ResolvedResumeShareRelease> {
  if (input.selection.kind === 'current') {
    // 当前快照提供者会先完成编辑器保存；工作版本只负责评论身份，
    // 其正文哈希不包含模板、字体和配色，不能用它还原当前外观。
    const source = await input.getCurrentSource(input.resumeId)

    for (let attempt = 0; attempt < 3; attempt++) {
      const version = await getCurrentResumeVersion(input.resumeId)

      const commentAnchor = buildCommentAnchorDocument(
        source.snapshot,
        version.projection_reference_date,
      )

      const versionAnchor = buildCommentAnchorDocument(
        mapSourceToPersistedSnapshot(version.snapshot),
        version.projection_reference_date,
      )

      if (commentAnchor.documentHash === versionAnchor.documentHash) {
        return {
          ...source,
          source: { kind: 'current' },
          versionId: version.id,
          documentRevision: version.document_revision,
          projectionReferenceDate: version.projection_reference_date,
          commentAnchorDocument: commentAnchor.document,
          commentDocumentHash: commentAnchor.documentHash,
        }
      }
      if (attempt === 2) break

      // 列表和分享管理没有编辑器监听者，必要时补齐已保存正文的评论版本。
      const client = new ResumeCommentClient({
        kind: 'owner',
        resumeId: input.resumeId,
      })

      try {
        await client.syncWorkingDocument({
          anchorDocument: commentAnchor.document,
          documentHash: commentAnchor.documentHash,
          projectionReferenceDate: version.projection_reference_date,
          expectedDocumentRevision: version.document_revision,
        })
      } catch (error) {
        if (
          !isResumeCommentClientError(error) ||
          error.code !== 'stale_document'
        )
          throw error
      }
    }

    throw new Error('简历内容正在变化，请保存完成后重新发布分享')
  }

  const version = await getResumeVersionForShare(
    input.resumeId,
    input.selection.versionId,
  )

  return resolveHistoryResumeShareRelease(
    input.selection.versionId,
    version,
    input.displayName,
  )
}

async function resolveHistoryResumeShareRelease(
  versionId: number,
  version: ResumeHistoryShareReleaseRow,
  displayName: string | null,
): Promise<ResolvedResumeShareRelease> {
  const snapshot = mapSourceToPersistedSnapshot(version.snapshot)

  const source = await buildResumeShareSnapshotSource(snapshot, displayName)

  const commentAnchor = buildCommentAnchorDocument(
    snapshot,
    version.projection_reference_date,
  )

  return {
    ...source,
    source: {
      kind: 'history',
      versionId,
      versionNo: version.version_no,
      versionLabel:
        version.version_name?.trim() ||
        version.milestone_name?.trim() ||
        '未命名版本',
      versionCreatedAt: version.created_at,
    },
    versionId,
    documentRevision: version.document_revision,
    projectionReferenceDate: version.projection_reference_date,
    commentAnchorDocument: commentAnchor.document,
    commentDocumentHash: commentAnchor.documentHash,
  }
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

/** 创建带明确版本来源的分享链接（owner）。 */
export async function createResumeShareRelease(
  resumeId: string,
  release: ResolvedResumeShareRelease,
  options: CreateShareOptions = {},
): Promise<ResumeShareRecord> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const policy = {
    ...sharePurposeDefaults(options.purpose ?? 'review'),
    ...options,
  }

  const job = options.jobId ? await readJobContext(options.jobId) : null

  if (job && job.resumeId !== resumeId)
    throw new Error('岗位准备中的简历已更换，请重新打开分享')

  if (policy.purpose === 'application' && release.source.kind === 'current') {
    const savedRow = await getResumeById<Record<string, unknown>>(
      resumeId,
      `${RESUME_PERSISTED_SELECTOR},display_name`,
    )

    const savedSnapshot = mapSourceToPersistedSnapshot(savedRow ?? {})

    const savedDisplayName =
      typeof savedRow?.display_name === 'string' ? savedRow.display_name : null

    const version = await createResumeHistoryVersion({
      resume_id: resumeId,
      version_name: job
        ? `用于投递${job.company}的版本`
        : options.label?.trim() || '用于正式投递的版本',
      company_id: job?.id ?? null,
      snapshot: savedSnapshot,
    })

    release = await resolveHistoryResumeShareRelease(
      version.id,
      version,
      savedDisplayName,
    )
  }

  const token = generateToken()
  const hasPassword = Boolean(options.password)

  const allowComments =
    policy.purpose === 'showcase' || !policy.showPhone || !policy.showEmail
      ? false
      : policy.allowComments

  const controller = new AbortController()
  let timedOut = false
  let shareId: string

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SHARE_PUBLISH_TIMEOUT_MS)

  try {
    const { data, error } = await supabase
      .rpc('create_resume_share_release', {
        ...toShareReleaseRpcParameters(release),
        p_resume_id: resumeId,
        p_token: token,
        p_label: options.label ?? null,
        p_expires_at: options.expiresAt ?? null,
        p_purpose: policy.purpose,
        p_show_phone: policy.showPhone,
        p_show_email: policy.showEmail,
        p_allow_comments: allowComments,
        p_activate: !hasPassword,
      })
      .abortSignal(controller.signal)

    if (error) throw error

    shareId = data
  } catch (error) {
    throw toPublishError(error, timedOut)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

  try {
    if (hasPassword) {
      await updateResumeShareSettings(shareId, {
        label: options.label ?? null,
        expiresAt: options.expiresAt ?? null,
        password: options.password!,
        allowComments,
        activate: true,
      })
    }

    return await getResumeShareRecord(shareId)
  } catch (error) {
    await deleteResumeShare(shareId).catch(() => undefined)

    throw error
  }
}

/** 撤销 / 启用 */
export async function setResumeShareActive(
  shareId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({ is_active: isActive })
    .eq('id', shareId)

  if (error) throw error
}

export async function updateResumeShareSettings(
  shareId: string,
  settings: {
    label: string | null
    expiresAt: string | null
    password: string | null | undefined
    allowComments: boolean
    showPhone?: boolean
    showEmail?: boolean
    activate?: true
  },
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  if (!token) throw new Error('用户未登录')

  const response = await fetch(getResumeShareFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      op: 'update_settings',
      shareId,
      label: settings.label,
      expiresAt: settings.expiresAt,
      allowComments: settings.allowComments,
      showPhone: settings.showPhone,
      showEmail: settings.showEmail,
      activate: settings.activate,
      ...(settings.password !== undefined
        ? { password: settings.password }
        : {}),
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')

    throw new Error(`更新分享设置失败: ${text}`)
  }
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

export async function archiveResumeShare(shareId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_resume_share', {
    p_share_id: shareId,
  })

  if (error) throw error
}

function toPublishError(error: unknown, timedOut: boolean): Error {
  if (timedOut) return new Error('发布超时，请稍后重试')

  const value = error as { code?: string; message?: string } | null

  if (value?.code === '55P03') return new Error('分享链接正在发布，请稍后重试')
  if (value?.message?.includes('upstream request timeout'))
    return new Error('发布超时，请稍后重试')
  if (error instanceof Error) return error

  return new Error('发布失败，请稍后重试')
}

function toShareReleaseRpcParameters(release: ResolvedResumeShareRelease) {
  const source = toShareVersionSourcePatch(release.source)

  return {
    p_version_id: release.versionId,
    p_snapshot: release.snapshot,
    p_template_manifest: release.templateManifest,
    p_display_name: release.displayName,
    p_source_kind: source.source_kind,
    p_source_version_id: source.source_version_id,
    p_source_version_no: source.source_version_no,
    p_source_version_label: source.source_version_label,
    p_source_version_created_at: source.source_version_created_at,
    p_anchor_document: release.commentAnchorDocument,
    p_document_hash: release.commentDocumentHash,
    p_projection_reference_date: release.projectionReferenceDate,
    p_expected_document_revision: release.documentRevision,
  }
}

async function performResumeShareReleasePublish(
  shareId: string,
  release: ResolvedResumeShareRelease,
): Promise<ResumeShareRecord> {
  const controller = new AbortController()
  let timedOut = false

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SHARE_PUBLISH_TIMEOUT_MS)

  try {
    const { error } = await supabase
      .rpc('publish_resume_share_release', {
        ...toShareReleaseRpcParameters(release),
        p_share_id: shareId,
      })
      .abortSignal(controller.signal)

    if (error) throw error

    return await getResumeShareRecord(shareId, controller.signal)
  } catch (error) {
    throw toPublishError(error, timedOut)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

/** 原子创建不可变 release，并切换分享链接的 current release 指针。 */
export function publishResumeShareRelease(
  shareId: string,
  release: ResolvedResumeShareRelease,
): Promise<ResumeShareRecord> {
  const pending = sharePublishRequests.get(shareId)

  if (pending) return pending

  const request = performResumeShareReleasePublish(shareId, release).finally(
    () => {
      if (sharePublishRequests.get(shareId) === request)
        sharePublishRequests.delete(shareId)
    },
  )

  sharePublishRequests.set(shareId, request)

  return request
}

export async function deleteResumeShare(shareId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_resume_share_permanently', {
    p_share_id: shareId,
  })

  if (error) throw error
}
