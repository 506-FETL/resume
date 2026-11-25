import type { IDBPObjectStore } from 'idb'
import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import { normalizeResumeType } from '@/lib/schema/resume/resume-type'
import { getDB, type ResumeDB } from './database'

type ResumeStore = IDBPObjectStore<ResumeDB, ['resumes'], 'resumes', 'readonly'>

type RecentKey = { id: string; date: string }

const CARD_LIMIT = 2

export async function getDashboardOfflineResumes() {
  const db = await getDB()
  const tx = db.transaction('resumes')
  const { store } = tx
  const dated = IDBKeyRange.lowerBound('', true)
  const updated = store.index('updated_at')

  const [total, updatedCount, recent] = await Promise.all([
    store.count(),
    updated.count(dated),
    readRecentKeys(updated, dated),
  ])

  if (updatedCount < total) await includeLegacyKeys(store, recent, dated, total)

  const items = await Promise.all(
    recent.map(async ({ id }) => {
      const record = (await store.get(id))!

      return {
        resume_id: record.resume_id,
        created_at: record.created_at || '',
        updated_at: record.updated_at || record.created_at || '',
        type: normalizeResumeType(record.type),
        display_name: record.display_name,
        parent_resume_id: record.parent_resume_id,
        templateBinding: readResumeListTemplateBinding(
          record.data?.templateBinding,
        ),
        isOffline: true,
      }
    }),
  )

  await tx.done

  return { total, items }
}

async function readRecentKeys(
  index: ReturnType<ResumeStore['index']>,
  dated: IDBKeyRange,
  excluded?: Set<string>,
) {
  const keys: RecentKey[] = []
  let cursor = await index.openKeyCursor(dated, 'prev')

  while (cursor) {
    if (!excluded?.has(cursor.primaryKey)) {
      keys.push({ id: cursor.primaryKey, date: cursor.key })

      if (keys.length === CARD_LIMIT) break
    }

    cursor = await cursor.continue()
  }

  return keys
}

async function includeLegacyKeys(
  store: ResumeStore,
  recent: RecentKey[],
  dated: IDBKeyRange,
  total: number,
) {
  const range =
    recent.length === CARD_LIMIT
      ? IDBKeyRange.lowerBound(recent[CARD_LIMIT - 1].date)
      : dated

  const created = store.index('created_at')
  // 超过已有候选数的一个主键，足以判断是否还有旧记录可能进入前两名。
  const candidates = await created.getAllKeys(range, recent.length + 1)

  if (candidates.some((id) => !recent.some((item) => item.id === id))) {
    const updated = new Set(await store.index('updated_at').getAllKeys(dated))

    recent.push(...(await readRecentKeys(created, range, updated)))

    recent.sort(
      (a, b) => indexedDB.cmp(b.date, a.date) || indexedDB.cmp(b.id, a.id),
    )

    recent.splice(CARD_LIMIT)
  }

  if (recent.length >= Math.min(total, CARD_LIMIT)) return

  // 两个日期都缺失时排在有日期的记录之后，仍可从首页打开。
  let cursor = await store.openKeyCursor(null, 'prev')

  while (cursor && recent.length < CARD_LIMIT) {
    const id = cursor.primaryKey

    if (!recent.some((item) => item.id === id)) recent.push({ id, date: '' })
    if (recent.length === CARD_LIMIT) break

    cursor = await cursor.continue()
  }
}
