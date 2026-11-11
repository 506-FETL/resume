import type { StoreApi } from 'zustand'
import type { ResumeItem } from '../types'
import type { ResumeLibraryCloudCounts } from '@/lib/supabase/resume/library'
import type { ResumeFilterMode } from './resume-ui'
import type { ResumeListState } from './types'
import type {
  LibraryPageResult,
  LibraryQueryCache,
  ResumeLibraryCounts,
} from './library-cache'
import {
  getOfflineResumeLibraryIndex,
  getOfflineResumeSummariesByIds,
} from '@/lib/offline-resume-manager'
import {
  getResumeLibraryCounts,
  getResumeLibraryPage,
  getResumeLibraryOptionsPage,
  getResumeLibraryParents,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import { getCurrentUser } from '@/lib/supabase/user'
import { getErrorMessage } from '@/utils'
import {
  matchesResumeLibraryQuery,
  normalizeResumeLibraryQuery,
} from '@/lib/resume-library-search'
import {
  createCompleteLibraryCache,
  createLibraryIndex,
  createLibraryQueryCache,
  readCachedLibraryItems,
  readCompleteLibraryItems,
} from './library-cache'
import { buildLibraryPage } from './library-page'
import { compareResumes, getFilterTotal, getLibraryPageNumber } from '../utils'

export type { ResumeLibraryCounts } from './library-cache'

export interface ResumeLibrarySlice {
  libraryActive: boolean
  libraryGeneration: number
  libraryAccountId: string | null
  libraryItems: ResumeItem[]
  libraryParents: Record<string, ResumeItem | null>
  libraryLoading: boolean
  libraryError: string | null
  libraryPage: number
  libraryTotal: number | null
  libraryCounts: ResumeLibraryCounts | null
  librarySearchInput: string
  libraryQuery: string
  libraryOptions: ResumeItem[]
  libraryOptionsLoading: boolean
  libraryOptionsError: string | null
  libraryPendingItems: ResumeItem[]
  libraryPendingLoading: boolean
  libraryPendingError: string | null
  libraryOfflineLoading: boolean
  libraryOfflineError: string | null
  loadLibraryPage: (page?: number) => Promise<void>
  refreshLibrary: () => Promise<void>
  invalidateLibrary: () => Promise<void>
  cancelLibraryLoad: () => void
  resetLibraryAccount: (accountId: string | null) => void
  setLibraryFilter: (filter: ResumeFilterMode) => void
  setLibrarySearchInput: (value: string) => void
  setLibraryQuery: (value: string) => Promise<void>
  loadLibraryOptions: (force?: boolean) => Promise<void>
  loadLibraryPendingItems: (force?: boolean) => Promise<void>
  loadLibraryOfflineOptions: (force?: boolean) => Promise<void>
}

const EMPTY_CLOUD_COUNTS: ResumeLibraryCloudCounts = {
  all: 0,
  roots: 0,
  variants: 0,
  readyVariants: 0,
  pending: 0,
}

export function createResumeLibrarySlice(
  set: StoreApi<ResumeListState>['setState'],
  get: StoreApi<ResumeListState>['getState'],
): ResumeLibrarySlice {
  let requestId = 0
  let revision = 0
  let queries = new Map<string, LibraryQueryCache>()
  let optionsLoaded = false
  let pendingLoaded = false
  let optionsRequest = 0
  let pendingRequest = 0
  let offlineLoaded = false
  let offlineRequest = 0

  function getQueryCache(query: string) {
    const existing = queries.get(query)

    if (existing?.completeItems) return existing

    const base = queries.get('')
    const complete = query && base ? readCompleteLibraryItems(base) : undefined

    if (complete) {
      const derived = createCompleteLibraryCache(
        complete.filter((item) => matchesResumeLibraryQuery(item, query)),
      )

      queries.set(query, derived)

      return derived
    }

    const cache = existing ?? createLibraryQueryCache()

    queries.set(query, cache)

    return cache
  }

  async function readIndex(ownerId: string | null, query = '') {
    const cache = getQueryCache(query)

    if (cache.index) return cache.index
    if (cache.indexRequest) return cache.indexRequest

    const currentRevision = revision

    const request = Promise.all([
      getOfflineResumeLibraryIndex(query),
      ownerId ? getResumeLibraryCounts(ownerId, query) : EMPTY_CLOUD_COUNTS,
    ]).then(([local, cloud]) => {
      const result = createLibraryIndex(local, cloud)

      if (currentRevision === revision) cache.index = result

      return result
    })

    cache.indexRequest = request

    try {
      return await request
    } finally {
      if (cache.indexRequest === request) cache.indexRequest = null
    }
  }

  async function readParents(items: ResumeItem[], ownerId: string | null) {
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

  async function loadAuxiliary(kind: 'options' | 'pending', force = false) {
    const loaded = kind === 'options' ? optionsLoaded : pendingLoaded

    const loading =
      kind === 'options'
        ? get().libraryOptionsLoading
        : get().libraryPendingLoading

    if (!force && (loaded || loading)) return

    const request = kind === 'options' ? ++optionsRequest : ++pendingRequest
    const currentRevision = revision

    const current = () =>
      currentRevision === revision &&
      request === (kind === 'options' ? optionsRequest : pendingRequest)

    set(
      kind === 'options'
        ? { libraryOptionsLoading: true, libraryOptionsError: null }
        : { libraryPendingLoading: true, libraryPendingError: null },
    )

    try {
      const user = await getCurrentUser()

      if (!current()) return

      const ownerId = user?.id ?? null
      const data = await readIndex(ownerId)
      const filter = kind === 'options' ? 'all' : 'pending'
      const expected = kind === 'options' ? data.cloud.all : data.cloud.pending
      const cloud: ResumeItem[] = []
      const local: ResumeItem[] = []

      const localIds = data.local[filter]

      await Promise.all([
        (async () => {
          while (ownerId && cloud.length < expected) {
            const batch =
              kind === 'options'
                ? await getResumeLibraryOptionsPage(ownerId, cloud.length)
                : await getResumeLibraryPage(ownerId, filter, cloud.length)

            if (!current()) return

            cloud.push(...batch)

            if (batch.length < RESUME_LIBRARY_PAGE_SIZE) break
          }
        })(),
        (async () => {
          for (
            let offset = 0;
            offset < localIds.length;
            offset += RESUME_LIBRARY_PAGE_SIZE
          ) {
            const batch = await getOfflineResumeSummariesByIds(
              localIds.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE),
            )

            if (!current()) return

            local.push(...batch)
          }
        })(),
      ])

      if (!current()) return

      const items = [...cloud, ...local].sort(compareResumes)

      const parents =
        kind === 'pending' ? await readParents(items, ownerId) : {}

      if (!current()) return

      set((state) => ({
        libraryParents: { ...state.libraryParents, ...parents },
      }))

      if (kind === 'options') {
        optionsLoaded = true
        set({ libraryOptions: items, offlineResumes: local })
      } else {
        pendingLoaded = true
        set({ libraryPendingItems: items })
      }
    } catch (error) {
      if (!current()) return

      const message = getErrorMessage(error)

      set(
        kind === 'options'
          ? { libraryOptionsError: message }
          : { libraryPendingError: message },
      )
    } finally {
      if (current())
        set(
          kind === 'options'
            ? { libraryOptionsLoading: false }
            : { libraryPendingLoading: false },
        )
    }
  }

  function clearCache() {
    revision += 1
    requestId += 1
    optionsRequest += 1
    pendingRequest += 1
    offlineRequest += 1
    queries = new Map()
  }

  async function readQueryPage(
    ownerId: string | null,
    query: string,
    filter: ResumeFilterMode,
    requestedPage: number,
    cache: LibraryQueryCache,
  ) {
    const key = `${filter}:${requestedPage}`
    const existing = cache.requests.get(key)

    if (existing) return existing

    const currentRevision = revision
    const current = () => currentRevision === revision

    const request = (async (): Promise<LibraryPageResult | undefined> => {
      const [data, firstCloudBatch] = await Promise.all([
        readIndex(ownerId, query),
        ownerId && !cache.pages.get(filter)?.has(1)
          ? getResumeLibraryPage(
              ownerId,
              filter,
              0,
              RESUME_LIBRARY_PAGE_SIZE,
              query,
            )
          : null,
        readIndex(ownerId),
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

      const parents = await readParents(loaded.items, ownerId)

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

  return {
    libraryActive: false,
    libraryGeneration: 0,
    libraryAccountId: null,
    libraryItems: [],
    libraryParents: {},
    libraryLoading: true,
    libraryError: null,
    libraryPage: 1,
    libraryTotal: null,
    libraryCounts: null,
    librarySearchInput: '',
    libraryQuery: '',
    libraryOptions: [],
    libraryOptionsLoading: false,
    libraryOptionsError: null,
    libraryPendingItems: [],
    libraryPendingLoading: false,
    libraryPendingError: null,
    libraryOfflineLoading: false,
    libraryOfflineError: null,

    loadLibraryPage: async (requestedPage = get().libraryPage) => {
      const request = ++requestId
      const currentRevision = revision
      const filter = get().filterMode
      const query = get().libraryQuery
      const cache = getQueryCache(query)

      const current = () =>
        request === requestId && currentRevision === revision

      const cachedPageNumber = cache.index
        ? getLibraryPageNumber(
            requestedPage,
            getFilterTotal(cache.index.counts, filter),
          )
        : requestedPage

      const cachedItems = readCachedLibraryItems(
        cache,
        filter,
        cachedPageNumber,
      )

      // 账户切换和数据变更会清空缓存；父简历信息补齐后才可直接展示。
      if (cache.index && cachedItems) {
        set({
          libraryActive: true,
          libraryLoading: false,
          libraryError: null,
          libraryItems: cachedItems,
          libraryPage: cachedPageNumber,
          libraryCounts: queries.get('')?.index?.counts ?? null,
          libraryTotal: getFilterTotal(cache.index.counts, filter),
        })

        return
      }

      set({ libraryActive: true, libraryLoading: true, libraryError: null })

      try {
        const user = await getCurrentUser()

        if (!current()) return

        const ownerId = user?.id ?? null

        if (get().libraryAccountId !== ownerId) {
          get().resetLibraryAccount(ownerId)

          return get().loadLibraryPage(1)
        }

        const result = await readQueryPage(
          ownerId,
          query,
          filter,
          requestedPage,
          cache,
        )

        if (!current() || !result) return

        set({
          libraryItems: result.items,
          libraryPage: result.page,
          libraryCounts: queries.get('')?.index?.counts ?? null,
          libraryTotal: result.total,
          isOnline: Boolean(user),
        })
      } catch (error) {
        if (current()) set({ libraryError: getErrorMessage(error) })
      } finally {
        if (current()) set({ libraryLoading: false })
      }
    },

    refreshLibrary: async () => {
      const reloadOptions = optionsLoaded || get().libraryOptionsLoading
      const reloadPending = pendingLoaded || get().libraryPendingLoading
      const reloadOffline = offlineLoaded || get().libraryOfflineLoading

      clearCache()

      set({
        libraryCounts: null,
        libraryTotal: null,
        libraryParents: {},
        libraryOptionsLoading: false,
        libraryPendingLoading: false,
        libraryOfflineLoading: false,
      })

      await Promise.all([
        get().loadLibraryPage(),
        reloadOptions ? loadAuxiliary('options', true) : Promise.resolve(),
        reloadPending ? loadAuxiliary('pending', true) : Promise.resolve(),
        reloadOffline
          ? get().loadLibraryOfflineOptions(true)
          : Promise.resolve(),
      ])
    },

    invalidateLibrary: async () => {
      if (get().libraryActive) return get().refreshLibrary()

      clearCache()
      optionsLoaded = false
      pendingLoaded = false
      offlineLoaded = false
    },

    cancelLibraryLoad: () => {
      requestId += 1
      set({ libraryActive: false, libraryLoading: false })
    },

    resetLibraryAccount: (accountId) => {
      clearCache()
      optionsLoaded = false
      pendingLoaded = false
      offlineLoaded = false

      set((state) => ({
        libraryGeneration: state.libraryGeneration + 1,
        libraryAccountId: accountId,
        libraryItems: [],
        libraryParents: {},
        libraryLoading: true,
        libraryError: null,
        libraryPage: 1,
        libraryTotal: null,
        libraryCounts: null,
        librarySearchInput: '',
        libraryQuery: '',
        libraryOptions: [],
        libraryOptionsLoading: false,
        libraryOptionsError: null,
        libraryPendingItems: [],
        libraryPendingLoading: false,
        libraryPendingError: null,
        libraryOfflineLoading: false,
        libraryOfflineError: null,
      }))
    },

    setLibraryFilter: (filter) => {
      if (get().filterMode === filter) return

      set({
        filterMode: filter,
        libraryPage: 1,
        libraryTotal: null,
      })

      get().loadLibraryPage(1)
    },

    setLibrarySearchInput: (value) => set({ librarySearchInput: value }),

    setLibraryQuery: async (value) => {
      const query = normalizeResumeLibraryQuery(value)

      if (get().libraryQuery === query) return

      set({ libraryQuery: query, libraryPage: 1, libraryTotal: null })

      await get().loadLibraryPage(1)
    },

    loadLibraryOptions: (force) => loadAuxiliary('options', force),
    loadLibraryPendingItems: (force) => loadAuxiliary('pending', force),

    loadLibraryOfflineOptions: async (force = false) => {
      if (!force && (offlineLoaded || get().libraryOfflineLoading)) return

      const request = ++offlineRequest
      const currentRevision = revision

      const current = () =>
        request === offlineRequest && currentRevision === revision

      set({ libraryOfflineLoading: true, libraryOfflineError: null })

      try {
        const localIndex =
          queries.get('')?.index?.local ??
          (await getOfflineResumeLibraryIndex())

        const items: ResumeItem[] = []

        for (
          let offset = 0;
          offset < localIndex.all.length;
          offset += RESUME_LIBRARY_PAGE_SIZE
        ) {
          const batch = await getOfflineResumeSummariesByIds(
            localIndex.all.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE),
          )

          if (!current()) return

          items.push(...batch)
        }

        if (!current()) return

        offlineLoaded = true
        set({ offlineResumes: items })
      } catch (error) {
        if (current()) set({ libraryOfflineError: getErrorMessage(error) })
      } finally {
        if (current()) set({ libraryOfflineLoading: false })
      }
    },
  }
}
