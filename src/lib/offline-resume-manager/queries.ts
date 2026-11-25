import { ResumeNotFoundError } from '@/lib/resume-id'
import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import type { ResumeListItem } from '@/lib/schema'
import type { IDBPObjectStore } from 'idb'
import type { OfflineResumeRecord, ResumeDB } from './database'
import { getDB } from './database'

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

export interface OfflineResumeLibraryIndex {
  all: string[]
  roots: string[]
  variants: string[]
  pending: string[]
  variantCount: number
}

type ResumeStore = IDBPObjectStore<ResumeDB, ['resumes'], 'resumes', 'readonly'>

function includeUndatedResumeIds(
  updated: string[],
  all: string[],
  limit?: number,
) {
  if (updated.length === all.length)
    return limit === undefined ? updated : updated.slice(0, limit)

  // 缺少更新时间的旧简历排在有效时间之后，按主键倒序补齐。
  const indexed = new Set(updated)
  const missing = all.reverse().filter((id) => !indexed.has(id))

  return updated.concat(missing).slice(0, limit)
}

async function readOrderedResumeIds(store: ResumeStore, limit?: number) {
  const updatedIndex = store.index('updated_at')

  if (limit === undefined || !Number.isInteger(limit) || limit < 0) {
    const [updated, all] = await Promise.all([
      updatedIndex.getAllKeys(),
      store.getAllKeys(),
    ])

    return includeUndatedResumeIds(updated.reverse(), all, limit)
  }

  const ids: string[] = []

  if (limit === 0) return ids

  let cursor = await updatedIndex.openKeyCursor(null, 'prev')

  while (cursor) {
    ids.push(cursor.primaryKey)

    if (ids.length === limit) return ids

    cursor = await cursor.continue()
  }

  return includeUndatedResumeIds(ids, await store.getAllKeys(), limit)
}

async function findMatchingResumeIds(store: ResumeStore, search: string) {
  if (!search) return null

  const matching = new Set<string>()

  await Promise.all(
    (['display_name', 'description'] as const).map(async (field) => {
      let cursor = await store.index(field).openKeyCursor()

      while (cursor) {
        if (cursor.key.toLowerCase().includes(search))
          matching.add(cursor.primaryKey)

        cursor = await cursor.continue()
      }
    }),
  )

  return matching
}

export async function getOfflineResumeLibraryIndex(
  search = '',
): Promise<OfflineResumeLibraryIndex> {
  const db = await getDB()
  const tx = db.transaction('resumes')
  const statusIndex = tx.store.index('derived_status')

  const [all, parentIds, readyIds, generatingIds, failedIds, matching] =
    await Promise.all([
      readOrderedResumeIds(tx.store),
      tx.store.index('parent_resume_id').getAllKeys(),
      statusIndex.getAllKeys('ready'),
      statusIndex.getAllKeys('generating'),
      statusIndex.getAllKeys('failed'),
      findMatchingResumeIds(tx.store, search),
    ])

  await tx.done

  const parents = new Set(parentIds)
  const ready = new Set(readyIds)
  const pending = new Set([...generatingIds, ...failedIds])
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
  const db = await getDB()
  const tx = db.transaction('resumes')
  const ids = await readOrderedResumeIds(tx.store, limit)

  await tx.done

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

/**
 * 检查是否为离线简历 ID
 */
export function isOfflineResumeId(resumeId: string): boolean {
  return resumeId.startsWith('local-')
}
