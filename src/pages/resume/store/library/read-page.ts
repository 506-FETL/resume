import { getOfflineResumeSummariesByIds } from '@/lib/offline-resume-manager'
import {
  getResumeLibraryPage,
  getResumeLibraryParents,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import type { ResumeItem } from '../../types'
import { getFilterTotal, getLibraryPageNumber } from '../../utils'
import type { LibraryPageResult, LibraryQueryCache } from '../library-cache'
import { readCachedLibraryItems } from '../library-cache'
import { buildLibraryPage } from '../library-page'
import type { ResumeFilterMode } from '../resume-ui'
import { readIndex } from './cache'
import type { LibraryGet, LibraryRuntime, LibrarySet } from './types'

export async function readParents(
  get: LibraryGet,
  items: ResumeItem[],
  ownerId: string | null,
) {
  const known = { ...get().libraryParents }

  for (const item of items) known[item.resume_id] = item

  const missing = [
    ...new Set(items.map((item) => item.parent_resume_id)),
  ].filter((id): id is string => Boolean(id) && !(id! in known))

  const cloudIds = missing.filter((id) => !id.startsWith('local-'))
  const localIds = missing.filter((id) => id.startsWith('local-'))

  const [cloudParents, localParents] = await Promise.all([
    ownerId && cloudIds.length
      ? getResumeLibraryParents(ownerId, cloudIds)
      : [],
    localIds.length ? getOfflineResumeSummariesByIds(localIds) : [],
  ])

  for (const id of missing) known[id] = null

  for (const parent of [...cloudParents, ...localParents])
    known[parent.resume_id] = parent

  return known
}

export async function readQueryPage(
  runtime: LibraryRuntime,
  set: LibrarySet,
  get: LibraryGet,
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

  const request = (async (): Promise<LibraryPageResult | undefined> => {
    const [data, firstCloudBatch] = await Promise.all([
      readIndex(runtime, ownerId, query),
      ownerId && !cache.pages.get(filter)?.has(1)
        ? getResumeLibraryPage(
            ownerId,
            filter,
            0,
            RESUME_LIBRARY_PAGE_SIZE,
            query,
          )
        : null,
    ])

    if (!current()) return

    const total = getFilterTotal(data.counts, filter)
    const page = getLibraryPageNumber(requestedPage, total)
    const cached = readCachedLibraryItems(cache, filter, page)

    if (cached) return { items: cached, page, total }

    const loaded = await buildLibraryPage({
      cache,
      data,
      ownerId,
      filter,
      query,
      page,
      firstCloudBatch,
      current,
    })

    if (!loaded || !current()) return

    const parents = await readParents(get, loaded.items, ownerId)

    if (!current()) return

    loaded.ready = true

    set((state) => ({
      libraryParents: { ...state.libraryParents, ...parents },
    }))

    return { items: loaded.items, page, total }
  })()

  cache.requests.set(key, request)

  try {
    return await request
  } finally {
    if (cache.requests.get(key) === request) cache.requests.delete(key)
  }
}
