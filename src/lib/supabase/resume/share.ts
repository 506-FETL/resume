import type { CreateShareOptions, CurrentResumeShareSnapshotProvider, ResolvedResumeShareRelease, ResumeShareRecord, ResumeShareSnapshotSource, ShareVersionSelection, ShareViewResult } from './share.types'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'
import { FORM_DATA_KEYS, FORM_FIELD_DEFAULTS } from '@/store/resume/const'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { getResumeById, RESUME_PERSISTED_SELECTOR } from './form'
import { getResumeHistoryVersionForShare } from './history'

const SHARE_SELECT = 'id,resume_id,user_id,token,label,display_name,is_active,has_password,expires_at,view_count,last_viewed_at,created_at,updated_at'

function toRecord(row: Record<string, any>): ResumeShareRecord {
  return row as ResumeShareRecord
}

function generateToken() {
  // 64 位十六进制随机串（两段 uuid 去横线拼接），足够长以抵抗枚举
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
}

function toPublicTemplateManifest(manifest: TemplateManifest): TemplateManifest {
  const meta = { ...manifest.meta }
  delete meta.ownerId
  return { ...manifest, meta }
}

function redactHiddenResumeSections(snapshot: PersistedResumeSnapshot): PersistedResumeSnapshot {
  const publicSnapshot = structuredClone(snapshot)
  const publicRecord = publicSnapshot as unknown as Record<string, unknown>

  for (const key of FORM_DATA_KEYS) {
    if (key === 'basics')
      continue

    if (publicSnapshot.visibility[key]) {
      publicRecord[key] = structuredClone(FORM_FIELD_DEFAULTS[key].default)
    }
  }

  return publicSnapshot
}

/** 从云端简历配置构造完整快照（列表卡片场景：页面未加载文档） */
export async function buildResumeShareSnapshotSource(
  snapshot: PersistedResumeSnapshot,
  displayName: string | null,
): Promise<ResumeShareSnapshotSource> {
  const publicSnapshot = redactHiddenResumeSections(snapshot)
  const fallback = getBuiltInTemplateManifest(
    publicSnapshot.templateBinding?.basedOnResumeType ?? publicSnapshot.type,
  )
  let templateManifest: TemplateManifest = fallback

  if (publicSnapshot.templateBinding) {
    const resolvedManifest = await getManifestFromTemplateBinding(publicSnapshot.templateBinding)
    if (!resolvedManifest && publicSnapshot.templateBinding.source !== 'official') {
      throw new Error('当前自定义模板无法加载，请稍后重试后再分享')
    }
    templateManifest = resolvedManifest ?? fallback
  }
  publicSnapshot.templateBinding = undefined

  return {
    snapshot: publicSnapshot,
    templateManifest: toPublicTemplateManifest(templateManifest),
    displayName,
  }
}

export async function getResumeSnapshotById(resumeId: string): Promise<ResumeShareSnapshotSource> {
  const source = await getResumeById<Record<string, unknown>>(resumeId, `${RESUME_PERSISTED_SELECTOR},display_name`)
  const snapshot = mapSourceToPersistedSnapshot(source ?? {})
  const displayName = (source as { display_name?: string | null } | null)?.display_name ?? null
  return buildResumeShareSnapshotSource(snapshot, displayName)
}

export async function resolveResumeShareRelease(input: {
  resumeId: string
  displayName: string | null
  selection: ShareVersionSelection
  getCurrentSource: CurrentResumeShareSnapshotProvider
}): Promise<ResolvedResumeShareRelease> {
  if (input.selection.kind === 'current') {
    return {
      ...await input.getCurrentSource(input.resumeId),
      source: { kind: 'current' },
    }
  }

  const version = await getResumeHistoryVersionForShare(
    input.resumeId,
    input.selection.versionId,
  )
  const source = await buildResumeShareSnapshotSource(
    mapSourceToPersistedSnapshot(version.snapshot),
    input.displayName,
  )

  return {
    ...source,
    source: {
      kind: 'history',
      versionId: input.selection.versionId,
      versionNo: version.version_no,
      versionLabel: version.version_name?.trim()
        || version.milestone_name?.trim()
        || '未命名版本',
      versionCreatedAt: version.created_at,
    },
  }
}

/** 列出某简历的所有分享链接（owner） */
export async function listResumeShares(resumeId: string): Promise<ResumeShareRecord[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('user_id', user.id)
    .eq('resume_id', resumeId)
    .order('created_at', { ascending: false })

  if (error)
    throw error
  return (data ?? []).map(toRecord)
}

export async function listAllResumeShares(): Promise<ResumeShareRecord[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error)
    throw error
  return (data ?? []).map(toRecord)
}

/** 创建分享链接（owner）。带密码时先 insert 再调 Function 写 hash。 */
export async function createResumeShare(
  resumeId: string,
  snapshot: PersistedResumeSnapshot,
  templateManifest: TemplateManifest,
  displayName: string | null,
  options: CreateShareOptions = {},
): Promise<ResumeShareRecord> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const token = generateToken()
  const hasPassword = Boolean(options.password)
  const { data, error } = await supabase
    .from('resume_shares')
    .insert({
      resume_id: resumeId,
      user_id: user.id,
      token,
      label: options.label ?? null,
      display_name: displayName,
      snapshot,
      template_manifest: templateManifest,
      expires_at: options.expiresAt ?? null,
      // 带密码时先不激活，密码写成功后再激活，避免残留可匿名访问的无密码记录
      ...(hasPassword ? { is_active: false } : {}),
    })
    .select(SHARE_SELECT)
    .single()

  if (error)
    throw error

  const record = toRecord(data)

  if (hasPassword) {
    try {
      await updateResumeShareSettings(record.id, {
        label: options.label ?? null,
        expiresAt: options.expiresAt ?? null,
        password: options.password!,
      })
      await setResumeShareActive(record.id, true)
      return { ...record, has_password: true, is_active: true }
    }
    catch (error) {
      await deleteResumeShare(record.id).catch(() => undefined)
      throw error
    }
  }
  return record
}

/** 撤销 / 启用 */
export async function setResumeShareActive(shareId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({ is_active: isActive })
    .eq('id', shareId)
  if (error)
    throw error
}

export async function updateResumeShareSettings(
  shareId: string,
  settings: {
    label: string | null
    expiresAt: string | null
    password: string | null | undefined
  },
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token)
    throw new Error('用户未登录')

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      op: 'update_settings',
      shareId,
      label: settings.label,
      expiresAt: settings.expiresAt,
      ...(settings.password !== undefined ? { password: settings.password } : {}),
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`更新分享设置失败: ${text}`)
  }
}

/** 推送最新快照覆盖 */
export async function pushResumeShareSnapshot(
  shareId: string,
  snapshot: PersistedResumeSnapshot,
  templateManifest: TemplateManifest,
  displayName: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({
      snapshot,
      template_manifest: templateManifest,
      display_name: displayName,
    })
    .eq('id', shareId)
  if (error)
    throw error
}

export async function deleteResumeShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .delete()
    .eq('id', shareId)
  if (error)
    throw error
}

/** 匿名读取分享内容（分享页调用；无需登录） */
export async function fetchSharedResume(token: string, password?: string): Promise<ShareViewResult> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...(password ? { password } : {}) }),
  })

  const body = await res.json().catch(() => null) as {
    needPassword?: boolean
    error?: string
    snapshot?: PersistedResumeSnapshot
    template_manifest?: TemplateManifest
    display_name?: string | null
  } | null

  if (!body)
    return { unavailable: true }

  if (body.needPassword) {
    return {
      needPassword: true,
      wrongPassword: body.error === 'wrong_password',
      rateLimited: body.error === 'rate_limited',
    }
  }

  if (!res.ok)
    return { unavailable: true }

  if (!body.snapshot || !body.template_manifest)
    return { unavailable: true }

  return {
    snapshot: body.snapshot,
    templateManifest: body.template_manifest,
    displayName: body.display_name ?? null,
  }
}
