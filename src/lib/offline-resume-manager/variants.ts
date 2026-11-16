import { applyVariantChange } from '@/components/jd-variant/utils/apply-changes'
import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import type {
  DerivedStatus,
  PersistedResumeSnapshot,
  VariantChange,
  VariantMetadata,
} from '@/lib/schema'
import dayjs from 'dayjs'
import { getDB } from './database'
import { hydrateOfflineResumeData } from './hydrate'
import { generateResumeId } from './mutations'

/**
 * 更新离线简历的 variant 相关字段（用于 JD 派生流程）
 */
export async function setVariantFieldsOffline(
  resumeId: string,
  fields: {
    parent_resume_id?: string | null
    linked_jd_text?: string | null
    derived_metadata?: VariantMetadata | null
    derived_status?: DerivedStatus | null
  },
) {
  const db = await getDB()
  const resume = await db.get('resumes', resumeId)

  if (!resume) {
    throw new Error('简历不存在')
  }

  const next = { ...resume, ...fields, updated_at: dayjs().toISOString() }

  await db.put('resumes', next)
  notifyResumeReadChanged(next.resume_id)
}

/**
 * 基于已有简历克隆一份草稿副本，用于 JD 派生流程
 */
export async function cloneOfflineResumeAsDraft(args: {
  parentResumeId: string
  jdText: string
  keywords: string[]
  summary?: string
  draftId?: string
}): Promise<string> {
  const db = await getDB()
  const parent = await db.get('resumes', args.parentResumeId)

  if (!parent) {
    throw new Error('源简历不存在')
  }

  const draftId = args.draftId ?? generateResumeId()
  const existing = await db.get('resumes', draftId)

  if (existing) {
    if (existing.parent_resume_id !== args.parentResumeId)
      throw new Error('派生目标不一致')
  }

  const cloneTitle = args.summary?.slice(0, 16) || args.keywords[0] || 'JD 变体'

  const initialMetadata: VariantMetadata = {
    keywords: args.keywords,
    changes: [],
    generatedAt: new Date().toISOString(),
    matchRate: 0,
  }

  await db.put('resumes', {
    resume_id: draftId,
    display_name: `${parent.display_name} - ${cloneTitle}`,
    description: `JD 变体 · ${new Date().toLocaleDateString()}`,
    type: parent.type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: hydrateOfflineResumeData({ ...(parent.data ?? {}) }),
    parent_resume_id: args.parentResumeId,
    linked_jd_text: args.jdText,
    derived_metadata: initialMetadata,
    derived_status: 'generating',
  })

  notifyResumeReadChanged(draftId)

  return draftId
}

/**
 * 使用与云端相同的字段映射和原文校验，将 changes 应用到离线 draft。
 */
export async function applyOfflineVariantChanges(
  draftResumeId: string,
  changes: VariantChange[],
): Promise<Partial<PersistedResumeSnapshot>> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)

  if (!draft) {
    throw new Error('草稿不存在')
  }

  let snapshot: Partial<PersistedResumeSnapshot> = (draft.data ??
    {}) as Partial<PersistedResumeSnapshot>

  for (const change of changes) {
    snapshot = applyVariantChange(snapshot, change)
  }

  if (snapshot === draft.data) {
    return snapshot
  }

  draft.data = snapshot
  draft.updated_at = dayjs().toISOString()
  await db.put('resumes', draft)
  notifyResumeReadChanged(draft.resume_id)

  return snapshot
}

/**
 * 将 draft 标记为 ready 并更新 metadata
 */
export async function markOfflineVariantReady(
  draftResumeId: string,
  args: {
    matchRate: number
    generatedAt: string
    changes?: VariantChange[]
    keywords?: string[]
  },
): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)

  if (!draft) {
    throw new Error('草稿不存在')
  }

  const prior = draft.derived_metadata ?? null

  draft.derived_metadata = {
    keywords: args.keywords ?? prior?.keywords ?? [],
    changes: args.changes ?? prior?.changes ?? [],
    matchRate: args.matchRate,
    generatedAt: args.generatedAt,
  }

  draft.derived_status = 'ready'
  draft.updated_at = dayjs().toISOString()
  await db.put('resumes', draft)
  notifyResumeReadChanged(draft.resume_id)
}

/**
 * 将 draft 标记为 failed 并写入错误描述
 */
export async function markOfflineVariantFailed(
  draftResumeId: string,
  message: string,
): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)

  if (!draft) {
    throw new Error('草稿不存在')
  }

  draft.derived_status = 'failed'
  draft.description = `派生失败：${message.slice(0, 200)}`
  draft.updated_at = dayjs().toISOString()
  await db.put('resumes', draft)
  notifyResumeReadChanged(draft.resume_id)
}

/**
 * 删除离线 draft 简历
 */
export async function deleteOfflineDraftVariant(
  draftResumeId: string,
): Promise<void> {
  const db = await getDB()

  await db.delete('resumes', draftResumeId)
}
