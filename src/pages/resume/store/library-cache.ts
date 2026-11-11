import type { ResumeItem } from '../types'
import type { ResumeLibraryCloudCounts } from '@/lib/supabase/resume/library'
import type { OfflineResumeLibraryIndex } from '@/lib/offline-resume-manager'
import type { ResumeFilterMode } from './resume-ui'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'
import { getFilterTotal } from '../utils'

export interface ResumeLibraryCounts {
  all: number
  cloud: number
  local: number
  variant: number
  roots: number
  readyVariants: number
  offline: number
  pending: number
}

export interface LibraryIndex {
  local: OfflineResumeLibraryIndex
  counts: ResumeLibraryCounts
  cloud: ResumeLibraryCloudCounts
}

export interface PageCursor {
  cloudOffset: number
  localOffset: number
  buffer: ResumeItem[]
  localBuffer: ResumeItem[]
}

export interface CachedPage {
  items: ResumeItem[]
  next: PageCursor
  ready: boolean
}

export interface LibraryPageResult {
  items: ResumeItem[]
  page: number
  total: number
}

export interface LibraryQueryCache {
  index: LibraryIndex | null
  indexRequest: Promise<LibraryIndex> | null
  pages: Map<ResumeFilterMode, Map<number, CachedPage>>
  requests: Map<string, Promise<LibraryPageResult | undefined>>
  completeItems?: ResumeItem[]
}

export function createLibraryQueryCache(): LibraryQueryCache {
  return {
    index: null,
    indexRequest: null,
    pages: new Map(),
    requests: new Map(),
  }
}

export function createLibraryIndex(
  local: OfflineResumeLibraryIndex,
  cloud: ResumeLibraryCloudCounts,
): LibraryIndex {
  return {
    local,
    cloud,
    counts: {
      all: cloud.all + local.all.length,
      cloud: cloud.roots,
      local: local.roots.length,
      variant: cloud.variants + local.variantCount,
      roots: cloud.roots + local.roots.length,
      readyVariants: cloud.readyVariants + local.variants.length,
      offline: local.all.length,
      pending: cloud.pending + local.pending.length,
    },
  }
}

export function createCompleteLibraryCache(items: ResumeItem[]) {
  const cache = createLibraryQueryCache()
  const cloud = items.filter((item) => !item.isOffline)
  const local = items.filter((item) => item.isOffline)

  cache.completeItems = items
  cache.index = createLibraryIndex(
    {
      all: local.map((item) => item.resume_id),
      roots: local.filter(isRoot).map((item) => item.resume_id),
      variants: local.filter(isReadyVariant).map((item) => item.resume_id),
      pending: local.filter(isPending).map((item) => item.resume_id),
      variantCount: local.filter((item) => !isRoot(item)).length,
    },
    {
      all: cloud.length,
      roots: cloud.filter(isRoot).length,
      variants: cloud.filter((item) => !isRoot(item)).length,
      readyVariants: cloud.filter(isReadyVariant).length,
      pending: cloud.filter(isPending).length,
    },
  )

  return cache
}

export function readCompleteLibraryItems(cache: LibraryQueryCache) {
  if (cache.completeItems) return cache.completeItems
  if (!cache.index) return

  const counts = cache.index.counts

  const filter = (['all', 'roots', 'variants'] as const).find(
    (candidate) =>
      getFilterTotal(counts, candidate) === counts.all &&
      cache.pages.has(candidate),
  )

  const pages = filter ? cache.pages.get(filter) : undefined
  const items: ResumeItem[] = []
  const pageCount = Math.ceil(counts.all / RESUME_LIBRARY_PAGE_SIZE)

  for (let page = 1; page <= pageCount; page += 1) {
    const source = pages?.get(page)

    if (!source?.ready) return

    items.push(...source.items)
  }

  if (items.length !== counts.all) return

  return items
}

export function readCachedLibraryItems(
  cache: LibraryQueryCache,
  filter: ResumeFilterMode,
  page: number,
) {
  if (!cache.index) return

  const cachedPage = cache.pages.get(filter)?.get(page)

  if (cachedPage?.ready) return cachedPage.items

  const counts = cache.index.counts
  const total = getFilterTotal(counts, filter)

  if (total === 0) return []

  // 子集数量等于全部时，数据顺序和云端 / 本地游标也完全相同。
  const equivalent = (['all', 'roots', 'variants'] as const).find(
    (candidate) =>
      candidate !== filter &&
      getFilterTotal(counts, candidate) === counts.all &&
      total === counts.all &&
      cache.pages.has(candidate),
  )

  const equivalentPages = equivalent ? cache.pages.get(equivalent) : undefined

  if (equivalentPages) {
    cache.pages.set(filter, equivalentPages)

    const equivalentPage = equivalentPages.get(page)

    if (equivalentPage?.ready) return equivalentPage.items
  }

  const allItems = readCompleteLibraryItems(cache)

  if (!allItems) return

  const matching =
    filter === 'all'
      ? allItems
      : allItems.filter(filter === 'roots' ? isRoot : isReadyVariant)

  if (matching.length !== total) return

  const offset = (page - 1) * RESUME_LIBRARY_PAGE_SIZE

  return matching.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE)
}

function isRoot(item: ResumeItem) {
  return !item.parent_resume_id
}

function isReadyVariant(item: ResumeItem) {
  return Boolean(item.parent_resume_id) && item.derived_status === 'ready'
}

function isPending(item: ResumeItem) {
  return (
    item.derived_status === 'generating' || item.derived_status === 'failed'
  )
}
