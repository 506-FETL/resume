/*
 * @Author: lll 347552878@qq.com
 * @Date: 2025-10-24 21:56:16
 * @LastEditors: shemingcong shemingcong@dcarlife.com
 * @LastEditTime: 2026-02-10 20:41:13
 * @FilePath: /resume/src/lib/offline-resume-manager.ts
 * @Description: 离线简历管理器,使用 IndexedDB 存储本地简历
 */

import type { DBSchema, IDBPDatabase } from 'idb'
import type { DerivedStatus, PersistedResumeSnapshot, ResumeAppearanceConfig, ResumeType, VariantChange, VariantMetadata } from '@/lib/schema'
import type { VariantLineage, VariantTreeNode } from '@/lib/supabase/resume/variant'
import dayjs from 'dayjs'
import { openDB } from 'idb'
import { applyVariantChange } from '@/components/jd-variant/utils/apply-changes'
import { createLegacyResumeTemplateBinding, DEFAULT_RESUME_APPEARANCE, normalizeResumeAppearance } from '@/lib/schema'

const MAX_VARIANT_TREE_DEPTH = 5

interface ResumeDB extends DBSchema {
  resumes: {
    key: string // resume_id
    value: {
      resume_id: string
      display_name: string
      description?: string
      type: ResumeType
      created_at: string
      updated_at: string
      data: Partial<PersistedResumeSnapshot>
      parent_resume_id?: string | null
      linked_jd_text?: string | null
      derived_metadata?: VariantMetadata | null
      derived_status?: DerivedStatus | null
    }
    indexes: {
      created_at: string
      updated_at: string
      parent_resume_id: string
      derived_status: string
    }
  }
}

type OfflineResumeRecord = ResumeDB['resumes']['value']

const DB_NAME = 'offline-resumes'
const DB_VERSION = 2

let dbInstance: IDBPDatabase<ResumeDB> | null = null
const LEGACY_STORAGE_KEY = 'resume-config-storage'

function hasPersistedAppearance(data: unknown): data is Partial<ResumeAppearanceConfig> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false
  }

  const record = data as Record<string, unknown>
  return record.spacing !== undefined || record.font !== undefined || record.theme !== undefined
}

function readLegacyLocalAppearance(): ResumeAppearanceConfig | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return normalizeResumeAppearance(parsed?.state)
  }
  catch {
    return null
  }
}

function hydrateOfflineResumeData(data: Partial<PersistedResumeSnapshot> | undefined): Partial<PersistedResumeSnapshot> {
  if (hasPersistedAppearance(data)) {
    return data
  }

  const appearance = readLegacyLocalAppearance() ?? DEFAULT_RESUME_APPEARANCE
  return {
    ...(data ?? {}),
    ...appearance,
  }
}

async function hydrateOfflineResumeRecord(
  db: IDBPDatabase<ResumeDB>,
  resume: OfflineResumeRecord | undefined,
): Promise<OfflineResumeRecord | undefined> {
  if (!resume) {
    return resume
  }

  if (hasPersistedAppearance(resume.data)) {
    return resume
  }

  const nextResume = {
    ...resume,
    data: hydrateOfflineResumeData(resume.data),
  }
  await db.put('resumes', nextResume)
  return nextResume
}

/**
 * 获取或创建数据库实例
 */
async function getDB(): Promise<IDBPDatabase<ResumeDB>> {
  if (dbInstance)
    return dbInstance

  dbInstance = await openDB<ResumeDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const resumeStore = db.createObjectStore('resumes', { keyPath: 'resume_id' })
        resumeStore.createIndex('created_at', 'created_at')
        resumeStore.createIndex('updated_at', 'updated_at')
      }
      if (oldVersion < 2) {
        const store = tx.objectStore('resumes')
        store.createIndex('parent_resume_id', 'parent_resume_id')
        store.createIndex('derived_status', 'derived_status')
      }
    },
  })

  // 当其他标签页升级数据库版本时，关闭当前连接以避免阻塞
  dbInstance.onversionchange = () => {
    dbInstance?.close()
    dbInstance = null
  }

  // 异常关闭时清除缓存引用，下次访问会重新打开
  dbInstance.onclose = () => {
    dbInstance = null
  }

  return dbInstance
}

/**
 * 生成唯一的简历 ID
 */
function generateResumeId(): string {
  return `local-${crypto.randomUUID()}`
}

/**
 * 创建新的离线简历
 */
export async function createOfflineResume(options: {
  display_name?: string
  description?: string
  type?: ResumeType
}) {
  const db = await getDB()
  const resumeId = generateResumeId()

  const resume = {
    resume_id: resumeId,
    display_name: options.display_name || '未命名简历',
    description: options.description || '',
    type: options.type || 'default',
    created_at: dayjs().toISOString(),
    updated_at: dayjs().toISOString(),
    data: {
      ...DEFAULT_RESUME_APPEARANCE,
      templateBinding: createLegacyResumeTemplateBinding(options.type || 'default'),
    },
    parent_resume_id: null,
    linked_jd_text: null,
    derived_metadata: null,
    derived_status: null,
  }

  await db.add('resumes', resume)

  return resumeId
}

/**
 * 获取所有离线简历
 */
export async function getAllOfflineResumes() {
  const db = await getDB()
  const resumes = await db.getAllFromIndex('resumes', 'created_at')
  const hydratedResumes = (await Promise.all(resumes.map(resume => hydrateOfflineResumeRecord(db, resume))))
    .filter((resume): resume is OfflineResumeRecord => Boolean(resume))

  // 按创建时间倒序排列
  return hydratedResumes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/**
 * 获取单个离线简历
 */
export async function getOfflineResumeById(resumeId: string) {
  const db = await getDB()
  return await hydrateOfflineResumeRecord(db, await db.get('resumes', resumeId))
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
}

/**
 * 更新简历元信息
 */
export async function updateOfflineResumeMeta(resumeId: string, meta: { display_name?: string, description?: string }) {
  const db = await getDB()
  const resume = await db.get('resumes', resumeId)

  if (!resume) {
    throw new Error('简历不存在')
  }

  if (meta.display_name !== undefined)
    resume.display_name = meta.display_name
  if (meta.description !== undefined)
    resume.description = meta.description
  resume.updated_at = dayjs().toISOString()

  await db.put('resumes', resume)
}

/**
 * 删除离线简历
 */
export async function deleteOfflineResume(resumeId: string) {
  const db = await getDB()
  await db.delete('resumes', resumeId)
}

/**
 * 检查是否为离线简历 ID
 */
export function isOfflineResumeId(resumeId: string): boolean {
  return resumeId.startsWith('local-')
}

/**
 * 清空所有离线简历（用于登录后迁移）
 */
export async function clearAllOfflineResumes() {
  const db = await getDB()
  await db.clear('resumes')
}

/**
 * 将本地简历迁移到云端
 * 用于登录后同步本地数据
 */
export async function migrateOfflineResumesToCloud(
  uploadFn: (resume: { display_name: string, description?: string, type: ResumeType, data: Partial<PersistedResumeSnapshot> }) => Promise<string>,
  selectedIds?: string[],
): Promise<{ success: number, failed: number, errors: string[] }> {
  let offlineResumes = await getAllOfflineResumes()

  // 如果指定了选择的ID，只迁移这些简历
  if (selectedIds && selectedIds.length > 0) {
    offlineResumes = offlineResumes.filter(r => selectedIds.includes(r.resume_id))
  }

  if (offlineResumes.length === 0) {
    return { success: 0, failed: 0, errors: [] }
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const resume of offlineResumes) {
    try {
      // 上传简历到云端
      await uploadFn({
        display_name: resume.display_name,
        description: resume.description,
        type: resume.type,
        data: resume.data,
      })

      // 上传成功后删除本地简历
      await deleteOfflineResume(resume.resume_id)
      success++
    }
    catch (error) {
      failed++
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      errors.push(`${resume.display_name}: ${errorMsg}`)
      console.error(`❌ 迁移简历失败: ${resume.display_name}`, error)
    }
  }

  return { success, failed, errors }
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

  return newResumeId
}

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
}

/**
 * 基于已有简历克隆一份草稿副本，用于 JD 派生流程
 */
export async function cloneOfflineResumeAsDraft(args: {
  parentResumeId: string
  jdText: string
  keywords: string[]
  summary?: string
}): Promise<string> {
  const db = await getDB()
  const parent = await db.get('resumes', args.parentResumeId)
  if (!parent) {
    throw new Error('源简历不存在')
  }
  const draftId = generateResumeId()
  const cloneTitle = args.summary?.slice(0, 16) || args.keywords[0] || 'JD 变体'
  const initialMetadata: VariantMetadata = {
    keywords: args.keywords,
    changes: [],
    generatedAt: new Date().toISOString(),
    matchRate: 0,
  }
  await db.add('resumes', {
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
  return draftId
}

/**
 * 将一组 changes 应用到离线 draft 上（依赖 Task 11 的 applyVariantChange）
 */
export async function applyOfflineVariantChanges(
  draftResumeId: string,
  changes: VariantChange[],
): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)
  if (!draft) {
    throw new Error('草稿不存在')
  }
  let snapshot: Partial<PersistedResumeSnapshot> = (draft.data ?? {}) as Partial<PersistedResumeSnapshot>
  for (const change of changes) {
    snapshot = applyVariantChange(snapshot, change)
  }
  draft.data = snapshot
  draft.updated_at = dayjs().toISOString()
  await db.put('resumes', draft)
}

/**
 * 将 draft 标记为 ready 并更新 metadata
 */
export async function markOfflineVariantReady(
  draftResumeId: string,
  args: { matchRate: number, generatedAt: string, changes?: VariantChange[], keywords?: string[] },
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
}

/**
 * 将 draft 标记为 failed 并写入错误描述
 */
export async function markOfflineVariantFailed(draftResumeId: string, message: string): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)
  if (!draft) {
    throw new Error('草稿不存在')
  }
  draft.derived_status = 'failed'
  draft.description = `派生失败：${message.slice(0, 200)}`
  draft.updated_at = dayjs().toISOString()
  await db.put('resumes', draft)
}

/**
 * 删除离线 draft 简历
 */
export async function deleteOfflineDraftVariant(draftResumeId: string): Promise<void> {
  const db = await getDB()
  await db.delete('resumes', draftResumeId)
}

/**
 * 构建以 currentResumeId 所属树为基准的 lineage：
 * - 先沿 parent 链向上找到真正的 root（visited 防环，无步数上限）
 * - 再从 root 向下 BFS 构建子树（深度上限 MAX_VARIANT_TREE_DEPTH）
 */
export async function fetchOfflineVariantTree(currentResumeId: string): Promise<VariantLineage> {
  const db = await getDB()
  const all = await db.getAll('resumes')
  const byId = new Map(all.map(r => [r.resume_id, r]))

  const visited = new Set<string>()
  let walker: string | null = currentResumeId
  let rootId = currentResumeId
  while (walker && !visited.has(walker)) {
    visited.add(walker)
    rootId = walker
    const node = byId.get(walker)
    walker = node?.parent_resume_id ?? null
  }

  const childrenByParent = new Map<string, OfflineResumeRecord[]>()
  for (const record of all) {
    const parentId = record.parent_resume_id ?? null
    if (!parentId) {
      continue
    }
    const list = childrenByParent.get(parentId)
    if (list) {
      list.push(record)
    }
    else {
      childrenByParent.set(parentId, [record])
    }
  }

  const seen = new Set<string>([rootId])
  function build(id: string, lvl: number): VariantTreeNode {
    const r = byId.get(id)
    if (!r) {
      throw new Error('简历节点不存在')
    }
    const childRecords = lvl >= MAX_VARIANT_TREE_DEPTH ? [] : (childrenByParent.get(id) ?? [])
    const children: VariantTreeNode[] = []
    for (const c of childRecords) {
      if (seen.has(c.resume_id)) {
        continue
      }
      seen.add(c.resume_id)
      children.push(build(c.resume_id, lvl + 1))
    }
    return {
      resumeId: r.resume_id,
      displayName: r.display_name,
      derivedStatus: r.derived_status ?? null,
      generatedAt: r.derived_metadata?.generatedAt ?? null,
      jdSnippet: r.linked_jd_text?.slice(0, 80) ?? null,
      matchRate: r.derived_metadata?.matchRate ?? null,
      children,
    }
  }

  return { root: build(rootId, 0), currentId: currentResumeId }
}
