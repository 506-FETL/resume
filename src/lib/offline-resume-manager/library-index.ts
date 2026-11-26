import type { IDBPObjectStore } from 'idb'
import { getDB, type ResumeDB } from './database'

export interface OfflineResumeLibraryIndex {
  all: string[]
  roots: string[]
  variants: string[]
  pending: string[]
  variantCount: number
}

type ResumeStore = IDBPObjectStore<ResumeDB, ['resumes'], 'resumes', 'readonly'>

export async function getOrderedOfflineResumeIds(limit?: number, offset = 0) {
  const db = await getDB()
  const tx = db.transaction('resumes')
  const ids = await readOrderedResumeIds(tx.store, limit, offset)

  await tx.done

  return ids
}

async function readOrderedResumeIds(
  store: ResumeStore,
  limit?: number,
  offset = 0,
) {
  const updated = store.index('updated_at')
  const dated = IDBKeyRange.lowerBound('', true)

  if (limit === undefined || !Number.isInteger(limit) || limit < 0) {
    const [keys, total] = await Promise.all([
      updated.getAllKeys(dated),
      store.count(),
    ])

    keys.reverse()

    if (keys.length === total)
      return limit === undefined ? keys : keys.slice(0, limit)

    const known = new Set(keys)
    const all = await store.getAllKeys()

    return keys
      .concat(all.reverse().filter((id) => !known.has(id)))
      .slice(0, limit)
  }

  const ids: string[] = []

  if (limit <= 0) return ids

  let cursor = await updated.openKeyCursor(dated, 'prev')

  if (cursor && offset) cursor = await cursor.advance(offset)

  while (cursor) {
    ids.push(cursor.primaryKey)

    if (ids.length === limit) return ids

    cursor = await cursor.continue()
  }

  // 旧记录缺少更新时间时排在所有有效日期之后，主键倒序补到本批上限。
  const [datedCount, total] = await Promise.all([
    updated.count(dated),
    store.count(),
  ])

  if (datedCount === total) return ids

  const known = new Set(offset ? await updated.getAllKeys(dated) : ids)
  let skip = Math.max(0, offset - datedCount)
  let fallback = await store.openKeyCursor(null, 'prev')

  while (fallback) {
    if (!known.has(fallback.primaryKey)) {
      if (skip > 0) skip -= 1
      else ids.push(fallback.primaryKey)
    }
    if (ids.length === limit) break

    fallback = await fallback.continue()
  }

  return ids
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

export async function getOfflineResumeLibraryGroups() {
  const db = await getDB()
  const tx = db.transaction('resumes')
  const groups = await readGroups(tx.store)

  await tx.done

  return groups
}

export type OfflineResumeLibraryGroups = Awaited<
  ReturnType<typeof getOfflineResumeLibraryGroups>
>

async function readGroups(store: ResumeStore) {
  const status = store.index('derived_status')

  const [total, parentIds, readyIds, generating, failed] = await Promise.all([
    store.count(),
    store.index('parent_resume_id').getAllKeys(),
    status.getAllKeys('ready'),
    status.getAllKeys('generating'),
    status.getAllKeys('failed'),
  ])

  const parents = new Set(parentIds)
  const ready = new Set(readyIds.filter((id) => parents.has(id)))
  const pending = new Set([...generating, ...failed])

  return {
    parents,
    ready,
    pending,
    counts: {
      all: total,
      roots: total - parents.size,
      variants: parents.size,
      readyVariants: ready.size,
      pending: pending.size,
    },
  }
}

export async function getOfflineResumeLibraryIndex(
  search = '',
  groups?: Promise<OfflineResumeLibraryGroups>,
): Promise<OfflineResumeLibraryIndex> {
  const db = await getDB()
  const tx = db.transaction('resumes')

  const [all, matching, { parents, ready, pending }] = await Promise.all([
    readOrderedResumeIds(tx.store),
    findMatchingResumeIds(tx.store, search),
    groups ?? readGroups(tx.store),
  ])

  await tx.done

  const visible = matching ? all.filter((id) => matching.has(id)) : all
  const roots = visible.filter((id) => !parents.has(id))

  return {
    all: visible,
    roots,
    variants: visible.filter((id) => ready.has(id)),
    pending: visible.filter((id) => pending.has(id)),
    variantCount: visible.length - roots.length,
  }
}
