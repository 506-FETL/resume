import type { ShareViewResult } from './share.types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { parseSharedTemplateDefinition } from '@/lib/resume-template/share'
import { getResumeShareFunctionUrl } from './share-function-url'

/** 匿名读取分享内容（分享页调用；无需登录） */
export async function fetchSharedResume(
  token: string,
  password?: string,
  options: {
    refresh?: boolean
    knownContentRevision?: string
    accessToken?: string
    signal?: AbortSignal
  } = {},
): Promise<ShareViewResult> {
  const res = await fetch(getResumeShareFunctionUrl(), {
    method: 'POST',
    signal: options.signal,
    cache: 'no-store',
    // 匿名 JSON 正文用 CORS 简单请求发送，避免冷访问先等待 OPTIONS。
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      token,
      knownContentRevision: options.knownContentRevision,
      accessToken: options.accessToken,
      ...(password ? { password } : {}),
      ...(options.refresh ? { refresh: true } : {}),
    }),
  })

  const body = (await res.json().catch(() => null)) as {
    source_kind?: 'current' | 'history'
    content_revision?: string
    not_modified?: boolean
    needPassword?: boolean
    error?: string
    snapshot?: PersistedResumeSnapshot
    template_manifest?: unknown
    display_name?: string | null
    share_id?: string
    release_id?: string
    release_no?: number
    version_id?: number
    document_revision?: number
    allow_comments?: boolean
    projection_reference_date?: string
    comment_scope_id?: string
    comment_access_token?: string
    comment_access_expires_at?: string
  } | null

  if (!body) throw new Error('Invalid share response')

  if (body.needPassword) {
    return {
      needPassword: true,
      wrongPassword: body.error === 'wrong_password',
      rateLimited: body.error === 'rate_limited',
    }
  }

  if (res.status >= 500 || res.status === 429)
    throw new Error('Share temporarily unavailable')

  if (!res.ok) return { unavailable: true }

  if (!body.not_modified && (!body.snapshot || !body.template_manifest))
    throw new Error('Incomplete share response')

  return {
    sourceKind: body.source_kind,
    contentRevision: body.content_revision,
    notModified: body.not_modified === true,
    snapshot: body.snapshot,
    templateDefinition: body.template_manifest
      ? parseSharedTemplateDefinition(body.template_manifest)
      : undefined,
    displayName: body.display_name ?? null,
    shareId: body.share_id,
    releaseId: body.release_id,
    releaseNo: body.release_no,
    versionId: body.version_id,
    documentRevision: body.document_revision,
    allowComments: body.allow_comments,
    projectionReferenceDate: body.projection_reference_date,
    commentScopeId: body.comment_scope_id,
    commentAccessToken: body.comment_access_token,
    commentAccessExpiresAt: body.comment_access_expires_at,
  }
}
