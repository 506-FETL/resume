import type { ResumeItem } from '../types'
import type { ResumeLibraryCloudCounts } from '@/lib/supabase/resume/library'
import type {
  OfflineResumeLibraryIndex,
  OfflineResumeLibraryGroups,
} from '@/lib/offline-resume-manager/library-index'
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
  counts: ResumeLibraryCounts
  cloud: ResumeLibraryCloudCounts
}

export interface PageCursor {
  cloudDone?: boolean
  cloudOffset: number
  localOffset: number
  buffer: ResumeItem[]
  localBuffer: ResumeItem[]
}

export interface CachedPage {
  items: ResumeItem[]
  hasNext: boolean
  next: PageCursor
}

export interface LibraryPageResult {
  items: ResumeItem[]
  page: number
  hasNext: boolean
}

export interface LibraryQueryCache {
  localGroups: Promise<OfflineResumeLibraryGroups> | null
  localRequest: Promise<OfflineResumeLibraryIndex> | null
  index: LibraryIndex | null
  indexRequest: Promise<LibraryIndex> | null
  pages: Map<ResumeFilterMode, Map<number, CachedPage>>
  requests: Map<string, Promise<LibraryPageResult | undefined>>
  completeItems?: ResumeItem[]
}

export function createLibraryQueryCache(): LibraryQueryCache {
  return {
    localGroups: null,
    localRequest: null,
    index: null,
    indexRequest: null,
    pages: new Map(),
    requests: new Map(),
  }
}

export function createLibraryIndex(
  local: ResumeLibraryCloudCounts,
  cloud: ResumeLibraryCloudCounts,
): LibraryIndex {
  return {
    cloud,
    counts: {
      all: cloud.all + local.all,
      cloud: cloud.roots,
      local: local.roots,
      variant: cloud.variants + local.variants,
      roots: cloud.roots + local.roots,
      readyVariants: cloud.readyVariants + local.readyVariants,
      offline: local.all,
      pending: cloud.pending + local.pending,
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
      all: local.length,
      roots: local.filter(isRoot).length,
      variants: local.filter((item) => !isRoot(item)).length,
      readyVariants: local.filter(isReadyVariant).length,
      pending: local.filter(isPending).length,
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

  if (pageCount && (!pages || pages.size < pageCount)) return

  for (let page = 1; page <= pageCount; page += 1) {
    const source = pages?.get(page)

    if (!source) return

    items.push(...source.items)
  }

  if (items.length !== counts.all) return

  cache.completeItems = items

  return items
}

export function readCachedLibraryItems(
  cache: LibraryQueryCache,
  filter: ResumeFilterMode,
  page: number,
) {
  const cachedPage = cache.pages.get(filter)?.get(page)

  if (cachedPage) return cachedPage.items
  if (!cache.index) return

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

    if (equivalentPage) return equivalentPage.items
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
