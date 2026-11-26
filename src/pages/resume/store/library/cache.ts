import {
  getOfflineResumeLibraryIndex,
  getOfflineResumeLibraryGroups,
} from '@/lib/offline-resume-manager/library-index'
import { matchesResumeLibraryQuery } from '@/lib/resume-library-search'
import type { ResumeLibraryCloudCounts } from '@/lib/supabase/resume/library'
import { getResumeLibraryCounts } from '@/lib/supabase/resume/library'
import {
  type LibraryQueryCache,
  createCompleteLibraryCache,
  createLibraryIndex,
  createLibraryQueryCache,
  readCompleteLibraryItems,
} from '../library-cache'
import type { LibraryRuntime } from './types'

export const EMPTY_CLOUD_COUNTS: ResumeLibraryCloudCounts = {
  all: 0,
  roots: 0,
  variants: 0,
  readyVariants: 0,
  pending: 0,
}

export function getQueryCache(runtime: LibraryRuntime, query: string) {
  const existing = runtime.queries.get(query)

  if (existing?.completeItems) return existing

  const base = runtime.queries.get('')
  const complete = query && base ? readCompleteLibraryItems(base) : undefined

  if (complete) {
    const derived = createCompleteLibraryCache(
      complete.filter((item) => matchesResumeLibraryQuery(item, query)),
    )

    runtime.queries.set(query, derived)

    return derived
  }

  const cache = existing ?? createLibraryQueryCache()

  runtime.queries.set(query, cache)

  return cache
}

export function readLocalIndex(cache: LibraryQueryCache, query = '') {
  if (cache.localRequest) return cache.localRequest

  const request = getOfflineResumeLibraryIndex(
    query,
    getLocalGroups(cache),
  ).catch((error) => {
    cache.localRequest = null

    throw error
  })

  cache.localRequest = request

  return request
}

function getLocalGroups(cache: LibraryQueryCache) {
  if (cache.localGroups) return cache.localGroups

  cache.localGroups = getOfflineResumeLibraryGroups().catch((error) => {
    cache.localGroups = null

    throw error
  })

  return cache.localGroups
}

export async function readIndex(
  runtime: LibraryRuntime,
  ownerId: string | null,
  query = '',
) {
  const cache = getQueryCache(runtime, query)

  if (cache.index) return cache.index
  if (cache.indexRequest) return cache.indexRequest

  const currentRevision = runtime.revision

  const request = Promise.all([
    query
      ? readLocalIndex(cache, query).then((local) => ({
          all: local.all.length,
          roots: local.roots.length,
          variants: local.variantCount,
          readyVariants: local.variants.length,
          pending: local.pending.length,
        }))
      : getLocalGroups(cache).then((groups) => groups.counts),
    ownerId ? getResumeLibraryCounts(ownerId, query) : EMPTY_CLOUD_COUNTS,
  ]).then(([local, cloud]) => {
    const result = createLibraryIndex(local, cloud)

    if (currentRevision === runtime.revision) cache.index = result

    return result
  })

  cache.indexRequest = request

  try {
    return await request
  } finally {
    if (cache.indexRequest === request) cache.indexRequest = null
  }
}

export function clearCache(runtime: LibraryRuntime) {
  runtime.revision += 1
  runtime.requestId += 1
  runtime.optionsRequest += 1
  runtime.pendingRequest += 1
  runtime.offlineRequest += 1
  runtime.queries = new Map()
  runtime.parentRequests = new Map()
  runtime.countsRequest = null
  runtime.optionsLoaded = false
  runtime.pendingLoaded = false
  runtime.offlineLoaded = false
}
