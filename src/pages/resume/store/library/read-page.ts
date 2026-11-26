import { getOrderedOfflineResumeIds } from '@/lib/offline-resume-manager/library-index'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'
import type { LibraryQueryCache } from '../library-cache'
import { buildLibraryPage } from '../library-page'
import type { ResumeFilterMode } from '../resume-ui'
import { readLocalIndex } from './cache'
import type { LibraryRuntime } from './types'

export async function readQueryPage(
  runtime: LibraryRuntime,
  ownerId: string | null,
  query: string,
  filter: ResumeFilterMode,
  requestedPage: number,
  cache: LibraryQueryCache,
) {
  const key = `${filter}:${requestedPage}`
  const existing = cache.requests.get(key)

  if (existing) return existing

  const currentRevision = runtime.revision
  const current = () => currentRevision === runtime.revision

  const limited =
    !query && filter === 'all' && requestedPage === 1 && !cache.localRequest

  const localIds = limited
    ? getOrderedOfflineResumeIds(RESUME_LIBRARY_PAGE_SIZE)
    : readLocalIndex(cache, query).then((local) => local[filter])

  const cloud = cache.index?.cloud

  const request = buildLibraryPage({
    cache,
    ownerId,
    filter,
    query,
    page: requestedPage,
    current,
    localIds,
    limited,
    cloudTotal: filter === 'variants' ? cloud?.readyVariants : cloud?.[filter],
  })

  cache.requests.set(key, request)

  try {
    return await request
  } finally {
    if (cache.requests.get(key) === request) cache.requests.delete(key)
  }
}
