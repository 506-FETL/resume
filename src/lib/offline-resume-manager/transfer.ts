import {
  derivedEvidence,
  flushPendingEvidence,
} from '@/lib/resume-preparation/evidence'
import {
  prepareOfflineTransfer,
  updatePreparation,
} from '@/lib/resume-preparation/storage'
import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import type { PersistedResumeSnapshot, ResumeType } from '@/lib/schema'
import { getCurrentUser } from '@/lib/supabase/user'
import { getDB } from './database'
import { hydrateOfflineResumeData } from './hydrate'
import { deleteOfflineResume, generateResumeId } from './mutations'
import { getOfflineResumeById } from './queries'

/**
 * 将本地简历迁移到云端
 * 用于登录后同步本地数据
 */
export async function migrateOfflineResumesToCloud(
  uploadFn: (
    resume: {
      display_name: string
      description?: string
      type: ResumeType
      data: Partial<PersistedResumeSnapshot>
    },
    targetId: string,
    ownerId: string,
  ) => Promise<string>,
  selectedIds?: string[],
  expectedOwner?: string,
): Promise<{
  success: number
  failed: number
  errors: string[]
  successIds: string[]
}> {
  const ownerId = expectedOwner ?? (await getCurrentUser())?.id

  const assertOwner = async () => {
    if (!ownerId || (await getCurrentUser())?.id !== ownerId)
      throw new Error('登录状态已改变，请使用发起同步时的账号重试')
  }

  await assertOwner()

  const ids =
    selectedIds ??
    (await getDB().then(async (db) => {
      const keys = await db.getAllKeysFromIndex('resumes', 'created_at')

      return keys.reverse()
    }))

  let success = 0
  let failed = 0
  const errors: string[] = []
  const successIds: string[] = []

  for (const id of new Set(ids)) {
    let displayName = '本地简历'

    try {
      await assertOwner()

      const resume = await getOfflineResumeById(id)

      if (!resume) continue

      displayName = resume.display_name

      const snapshotSignature = JSON.stringify(resume)

      await flushPendingEvidence(resume.resume_id, ownerId!)
      await flushPendingEvidence(resume.resume_id, null)

      const inheritedAi = derivedEvidence(
        resume.derived_metadata,
        resume.data as PersistedResumeSnapshot,
      )

      if (inheritedAi.length)
        await updatePreparation(resume.resume_id, ownerId!, (record) => ({
          ...record,
          evidence: [
            ...new Map(
              [...record.evidence, ...inheritedAi].map((item) => [
                item.id,
                item,
              ]),
            ).values(),
          ],
        }))

      const targetId = await prepareOfflineTransfer(resume.resume_id, ownerId!)

      await assertOwner()

      const uploadedId = await uploadFn(
        {
          display_name: resume.display_name,
          description: resume.description,
          type: resume.type,
          data: resume.data,
        },
        targetId,
        ownerId!,
      )

      if (uploadedId !== targetId) throw new Error('同步目标不一致，请重试')

      await assertOwner()

      // 上传成功后删除本地简历
      await deleteOfflineResume(
        resume.resume_id,
        assertOwner,
        snapshotSignature,
      )

      success++
      successIds.push(resume.resume_id)
    } catch (error) {
      failed++

      const errorMsg = error instanceof Error ? error.message : '未知错误'

      errors.push(`${displayName}: ${errorMsg}`)
      console.error(`迁移简历失败: ${displayName}`, error)
    }
  }

  return { success, failed, errors, successIds }
}

/**
 * 导出离线简历为 JSON（用于备份或迁移）
 */
export async function exportOfflineResume(resumeId: string): Promise<string> {
  const resume = await getOfflineResumeById(resumeId)

  if (!resume) {
    throw new Error('简历不存在')
  }

  return JSON.stringify(resume, null, 2)
}

/**
 * 导入离线简历（从 JSON）
 */
export async function importOfflineResume(jsonData: string): Promise<string> {
  const data = JSON.parse(jsonData)
  const db = await getDB()

  // 生成新的 ID 避免冲突
  const newResumeId = generateResumeId()

  const resume = {
    ...data,
    resume_id: newResumeId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: hydrateOfflineResumeData(data.data),
  }

  await db.add('resumes', resume)
  notifyResumeReadChanged(resume.resume_id)

  return newResumeId
}
