import { ResumeNotFoundError } from '@/lib/resume-id'
import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import type { ResumeListItem } from '@/lib/schema'
import type { OfflineResumeRecord } from './database'
import { getDB } from './database'
import { hydrateOfflineResumeRecord } from './hydrate'

/**
 * 获取所有离线简历
 */
export async function getAllOfflineResumes() {
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

export interface OfflineResumeLibraryIndex {
  all: string[]
  roots: string[]
  variants: string[]
  pending: string[]
  variantCount: number
}

export async function getOfflineResumeLibraryIndex(
  search = '',
): Promise<OfflineResumeLibraryIndex> {
  const db = await getDB()
  const tx = db.transaction('resumes')
  const all: string[] = []
  const parents = new Set<string>()
  const ready = new Set<string>()
  const pending = new Set<string>()
  const matching = search ? new Set<string>() : null

  let updatedCursor = await tx.store
    .index('updated_at')
    .openKeyCursor(null, 'prev')

  while (updatedCursor) {
    all.push(updatedCursor.primaryKey)
    updatedCursor = await updatedCursor.continue()
  }

  // 旧导入可能没有更新时间；只补齐缺失的键，正文仍在翻到该页时读取。
  const known = new Set(all)

  const missing = (await tx.store.getAllKeys())
    .filter((id) => !known.has(id))
    .sort()
    .reverse()

  all.push(...missing)

  let parentCursor = await tx.store.index('parent_resume_id').openKeyCursor()

  while (parentCursor) {
    parents.add(parentCursor.primaryKey)
    parentCursor = await parentCursor.continue()
  }

  let statusCursor = await tx.store.index('derived_status').openKeyCursor()

  while (statusCursor) {
    if (statusCursor.key === 'ready') ready.add(statusCursor.primaryKey)
    if (statusCursor.key === 'generating' || statusCursor.key === 'failed')
      pending.add(statusCursor.primaryKey)

    statusCursor = await statusCursor.continue()
  }

  if (matching) {
    for (const field of ['display_name', 'description'] as const) {
      let cursor = await tx.store.index(field).openKeyCursor()

      while (cursor) {
        if (cursor.key.toLowerCase().includes(search))
          matching.add(cursor.primaryKey)

        cursor = await cursor.continue()
      }
    }
  }

  await tx.done

  const visible = matching ? all.filter((id) => matching.has(id)) : all

  return {
    all: visible,
    roots: visible.filter((id) => !parents.has(id)),
    variants: visible.filter((id) => parents.has(id) && ready.has(id)),
    pending: visible.filter((id) => pending.has(id)),
    variantCount: visible.filter((id) => parents.has(id)).length,
  }
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

      const { data, ...summary } = record

      summaries.push({
        ...summary,
        isOffline: true,
        templateBinding: readResumeListTemplateBinding(data?.templateBinding),
      })
    }
  }

  return summaries
}

export async function getOfflineResumeSummaries(limit?: number) {
  const index = await getOfflineResumeLibraryIndex()

  const summaries = await getOfflineResumeSummariesByIds(
    limit === undefined ? index.all : index.all.slice(0, limit),
  )

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

/**
 * 检查是否为离线简历 ID
 */
export function isOfflineResumeId(resumeId: string): boolean {
  return resumeId.startsWith('local-')
}
