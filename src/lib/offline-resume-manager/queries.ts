import { ResumeNotFoundError } from '@/lib/resume-id'
import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import type { ResumeListItem } from '@/lib/schema'
import { getDB, type OfflineResumeRecord } from './database'
import { getOrderedOfflineResumeIds } from './library-index'

export {
  getOfflineResumeLibraryIndex,
  type OfflineResumeLibraryIndex,
} from './library-index'

/**
 * 获取所有离线简历
 */
export async function getAllOfflineResumes() {
  const { hydrateOfflineResumeRecord } = await import('./hydrate')

  const db = await getDB()
  const resumes = await db.getAllFromIndex('resumes', 'created_at')

  const hydratedResumes = (
    await Promise.all(
      resumes.map((resume) => hydrateOfflineResumeRecord(db, resume)),
    )
  ).filter((resume): resume is OfflineResumeRecord => Boolean(resume))

  // 按创建时间倒序排列
  return hydratedResumes.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export async function getOfflineResumeSummariesByIds(
  ids: string[],
): Promise<ResumeListItem[]> {
  const db = await getDB()
  const summaries: ResumeListItem[] = []

  for (let offset = 0; offset < ids.length; offset += 10) {
    const tx = db.transaction('resumes')

    const records = await Promise.all(
      ids.slice(offset, offset + 10).map((id) => tx.store.get(id)),
    )

    await tx.done

    for (const record of records) {
      if (!record) continue

      const { data, linked_jd_text, derived_metadata, ...summary } = record

      summaries.push({
        ...summary,
        linked_jd_excerpt: linked_jd_text?.slice(0, 80),
        derived_match_rate: derived_metadata?.matchRate,
        isOffline: true,
        templateBinding: readResumeListTemplateBinding(data?.templateBinding),
      })
    }
  }

  return summaries
}

export async function getOfflineResumeSummaries(limit?: number) {
  const ids = await getOrderedOfflineResumeIds(limit)

  const summaries = await getOfflineResumeSummariesByIds(ids)

  return summaries.map((resume) => ({
    resume_id: resume.resume_id,
    created_at: resume.created_at,
    updated_at: resume.updated_at,
    type: resume.type,
    display_name: resume.display_name,
    description: resume.description,
    parent_resume_id: resume.parent_resume_id,
    derived_status: resume.derived_status,
    templateBinding: resume.templateBinding,
    isOffline: true,
  }))
}

/**
 * 获取单个离线简历
 */
export async function getOfflineResumeById(resumeId: string) {
  const { hydrateOfflineResumeRecord } = await import('./hydrate')

  const db = await getDB()

  return await hydrateOfflineResumeRecord(db, await db.get('resumes', resumeId))
}

export async function getOfflineResumeProjection(
  resumeId: string,
  keys: readonly string[],
): Promise<Record<string, unknown>> {
  const db = await getDB()
  const record = await db.get('resumes', resumeId)

  if (!record) throw new ResumeNotFoundError()

  const source = { ...record.data, ...record } as Record<string, unknown>

  return Object.fromEntries(keys.map((key) => [key, source[key]]))
}

export { isOfflineResumeId } from '@/lib/resume-id'
