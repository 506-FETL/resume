import { normalizeResumeLibraryQuery } from '@/lib/resume-library-search'
import { getCurrentUser } from '@/lib/supabase/user'
import { getErrorMessage } from '@/utils'
import { getFilterTotal, getLibraryPageNumber } from '../../utils'
import { readCachedLibraryItems } from '../library-cache'
import { createAuxiliaryActions, loadAuxiliary } from './auxiliary'
import { clearCache, getQueryCache, readIndex } from './cache'
import { readQueryPage } from './read-page'
import type {
  LibraryGet,
  LibraryRuntime,
  LibrarySet,
  ResumeLibrarySlice,
} from './types'

export function createResumeLibrarySlice(
  set: LibrarySet,
  get: LibraryGet,
): ResumeLibrarySlice {
  const runtime: LibraryRuntime = {
    requestId: 0,
    revision: 0,
    queries: new Map(),
    optionsLoaded: false,
    pendingLoaded: false,
    optionsRequest: 0,
    pendingRequest: 0,
    offlineLoaded: false,
    offlineRequest: 0,
    countsRequest: null,
  }

  return {
    libraryActive: false,
    libraryGeneration: 0,
    libraryAccountId: null,
    libraryItems: [],
    libraryParents: {},
    libraryLoading: true,
    libraryError: null,
    libraryHasLoaded: false,
    libraryCountsLoading: true,
    libraryCountsError: null,
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
    loadLibraryCounts: () => {
      if (runtime.countsRequest) return runtime.countsRequest

      const currentRevision = runtime.revision
      const ownerId = get().libraryAccountId

      const current = () =>
        currentRevision === runtime.revision &&
        ownerId === get().libraryAccountId

      set({ libraryCountsLoading: true, libraryCountsError: null })

      const request = readIndex(runtime, ownerId)
        .then((data) => {
          if (current()) set({ libraryCounts: data.counts })
        })
        .catch((error: unknown) => {
          if (current()) set({ libraryCountsError: getErrorMessage(error) })
        })
        .finally(() => {
          if (current()) set({ libraryCountsLoading: false })
          if (runtime.countsRequest === request) runtime.countsRequest = null
        })

      runtime.countsRequest = request

      return request
    },
    loadLibraryPage: async (requestedPage = get().libraryPage) => {
      const request = ++runtime.requestId
      const currentRevision = runtime.revision
      const filter = get().filterMode
      const query = get().libraryQuery
      const cache = getQueryCache(runtime, query)

      const current = () =>
        request === runtime.requestId && currentRevision === runtime.revision

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
          libraryHasLoaded: true,
          libraryPage: cachedPageNumber,
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

        get().loadLibraryCounts()

        const result = await readQueryPage(
          runtime,
          set,
          get,
          ownerId,
          query,
          filter,
          requestedPage,
          cache,
        )

        if (!current() || !result) return

        set({
          libraryItems: result.items,
          libraryHasLoaded: true,
          libraryPage: result.page,
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
      const reloadOptions = runtime.optionsLoaded || get().libraryOptionsLoading
      const reloadPending = runtime.pendingLoaded || get().libraryPendingLoading
      const reloadOffline = runtime.offlineLoaded || get().libraryOfflineLoading

      clearCache(runtime)

      set({
        libraryTotal: null,
        libraryParents: {},
        libraryOptionsLoading: false,
        libraryPendingLoading: false,
        libraryOfflineLoading: false,
      })

      await Promise.all([
        get().loadLibraryPage(),
        reloadOptions
          ? loadAuxiliary(runtime, set, get, 'options', true)
          : Promise.resolve(),
        reloadPending
          ? loadAuxiliary(runtime, set, get, 'pending', true)
          : Promise.resolve(),
        reloadOffline
          ? get().loadLibraryOfflineOptions(true)
          : Promise.resolve(),
      ])
    },
    invalidateLibrary: async () => {
      if (get().libraryActive) return get().refreshLibrary()

      clearCache(runtime)
      runtime.optionsLoaded = false
      runtime.pendingLoaded = false
      runtime.offlineLoaded = false
    },
    cancelLibraryLoad: () => {
      runtime.requestId += 1
      set({ libraryActive: false, libraryLoading: false })
    },
    resetLibraryAccount: (accountId) => {
      clearCache(runtime)
      runtime.optionsLoaded = false
      runtime.pendingLoaded = false
      runtime.offlineLoaded = false

      set((state) => ({
        libraryGeneration: state.libraryGeneration + 1,
        libraryAccountId: accountId,
        libraryItems: [],
        libraryParents: {},
        libraryLoading: true,
        libraryError: null,
        libraryHasLoaded: false,
        libraryCountsLoading: true,
        libraryCountsError: null,
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
    ...createAuxiliaryActions(runtime, set, get),
  }
}
