import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import type { PreparedResumeCreation } from '@/lib/resume-template/create/types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import dayjs from 'dayjs'
import type { OfflineResumeRecord } from './database'
import { getDB } from './database'
import { hydrateOfflineResumeData } from './hydrate'

/**
 * 生成唯一的简历 ID
 */
export function generateResumeId(): string {
  return `local-${crypto.randomUUID()}`
}

export async function createOfflineResumeFromSnapshot(
  prepared: PreparedResumeCreation,
) {
  if (
    prepared.mode !== 'local' ||
    prepared.resumeId !== `local-${prepared.operationId}`
  )
    throw new Error('本地创建操作无效')

  const db = await getDB()
  const now = dayjs().toISOString()

  const record: OfflineResumeRecord = {
    resume_id: prepared.resumeId,
    display_name: prepared.displayName,
    description: prepared.description,
    type: 'default',
    created_at: now,
    updated_at: now,
    data: structuredClone(prepared.snapshot),
    parent_resume_id: null,
    linked_jd_text: null,
    derived_metadata: null,
    derived_status: null,
  }

  await db.add('resumes', record)
  notifyResumeReadChanged(record.resume_id)

  return record
}

/**
 * 更新离线简历数据
 */
export async function updateOfflineResume(
  resumeId: string,
  data: Partial<PersistedResumeSnapshot>,
) {
  const db = await getDB()
  const resume = await db.get('resumes', resumeId)

  if (!resume) {
    throw new Error('简历不存在')
  }

  resume.data = { ...hydrateOfflineResumeData(resume.data), ...data }
  resume.updated_at = dayjs().toISOString()

  await db.put('resumes', resume)
  notifyResumeReadChanged(resume.resume_id)
}

/**
 * 更新简历元信息
 */
export async function updateOfflineResumeMeta(
  resumeId: string,
  meta: { display_name?: string; description?: string },
) {
  const db = await getDB()
  const resume = await db.get('resumes', resumeId)

  if (!resume) {
    throw new Error('简历不存在')
  }

  if (meta.display_name !== undefined) resume.display_name = meta.display_name
  if (meta.description !== undefined) resume.description = meta.description

  resume.updated_at = dayjs().toISOString()

  await db.put('resumes', resume)
  notifyResumeReadChanged(resume.resume_id)
}

/**
 * 删除离线简历
 */
export async function deleteOfflineResume(
  resumeId: string,
  beforeDelete?: () => void | Promise<void>,
  expectedSnapshot?: string,
) {
  const db = await getDB()

  await beforeDelete?.()

  const tx = db.transaction('resumes', 'readwrite')
  const current = await tx.store.get(resumeId)

  if (expectedSnapshot && JSON.stringify(current) !== expectedSnapshot) {
    tx.abort()
    await tx.done.catch(() => undefined)

    throw new Error(
      '同步期间本地简历有新修改，已保留本地内容。请核对云端副本后再处理。',
    )
  }

  await tx.store.delete(resumeId)
  await tx.done
  notifyResumeReadChanged(resumeId)
}

/**
 * 清空所有离线简历（用于登录后迁移）
 */
export async function clearAllOfflineResumes() {
  const db = await getDB()

  await db.clear('resumes')
}
