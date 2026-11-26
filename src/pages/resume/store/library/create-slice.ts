import { normalizeResumeLibraryQuery } from '@/lib/resume-library-search'
import { getCurrentUser } from '@/lib/supabase/user'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import { getFilterTotal, getLibraryPageNumber } from '../../utils'
import { readCachedLibraryItems } from '../library-cache'
import { createAuxiliaryActions } from './auxiliary'
import { clearCache, getQueryCache, readIndex } from './cache'
import { readQueryPage } from './read-page'
import { loadLibraryParents, rememberLibraryItems } from './parents'
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
  const updateVersions = new Map<string, string>()

  const runtime: LibraryRuntime = {
    requestId: 0,
    revision: 0,
    queries: new Map(),
    parentRequests: new Map(),
    optionsLoaded: false,
    pendingLoaded: false,
    optionsRequest: 0,
    pendingRequest: 0,
    offlineLoaded: false,
    offlineRequest: 0,
    countsRequest: null,
  }

  function prepareParents(items: ResumeLibrarySlice['libraryItems']) {
    rememberLibraryItems(set, get, items)

    const ids = items.flatMap((item) =>
      item.parent_resume_id ? [item.parent_resume_id] : [],
    )

    if (ids.length) get().loadLibraryParents(ids)
  }

  function invalidateData() {
    clearCache(runtime)

    set((state) => ({
      libraryTotal: null,
      libraryCountsError: null,
      libraryParents: {},
      libraryParentErrors: {},
      libraryAuxiliaryRevision: state.libraryAuxiliaryRevision + 1,
      libraryOptionsLoading: false,
      libraryPendingLoading: false,
      libraryOfflineLoading: false,
    }))
  }

  return {
    libraryActive: false,
    libraryGeneration: 0,
    libraryAccountId: null,
    libraryItems: [],
    libraryParents: {},
    libraryParentErrors: {},
    libraryLoading: true,
    libraryError: null,
    libraryHasLoaded: false,
    libraryHasNextPage: false,
    libraryCountsLoading: true,
    libraryCountsError: null,
    libraryPage: 1,
    libraryTotal: null,
    librarySearchCountError: null,
    libraryAuxiliaryRevision: 0,
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
    loadLibraryParents: (ids) => loadLibraryParents(runtime, set, get, ids),
    loadLibraryCounts: () => {
      if (runtime.countsRequest) return runtime.countsRequest

      const cached = runtime.queries.get('')?.index

      if (cached && get().libraryCounts === cached.counts)
        return Promise.resolve()

      const currentRevision = runtime.revision
      const ownerId = get().libraryAccountId

      const current = () =>
        currentRevision === runtime.revision &&
        ownerId === get().libraryAccountId

      set({ libraryCountsLoading: true, libraryCountsError: null })

      const request = readIndex(runtime, ownerId)
        .then((data) => {
          if (!current()) return

          set((state) => ({
            libraryCounts: data.counts,
            ...(!state.libraryQuery && {
              libraryTotal: getFilterTotal(data.counts, state.filterMode),
            }),
          }))
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

      try {
        const identity = useUserStore.getState()

        const ownerId =
          identity.authStatus === 'unknown'
            ? ((await getCurrentUser())?.id ?? null)
            : (identity.currentUser?.id ?? null)

        if (!current()) return

        if (get().libraryAccountId !== ownerId) {
          get().resetLibraryAccount(ownerId)

          return get().loadLibraryPage(1)
        }

        if (!get().libraryCountsError) get().loadLibraryCounts()

        if (query && !cache.index) {
          readIndex(runtime, ownerId, query).then(
            (index) => {
              if (current())
                set({ libraryTotal: getFilterTotal(index.counts, filter) })
            },
            (error: unknown) => {
              if (current())
                set({ librarySearchCountError: getErrorMessage(error) })
            },
          )
        }

        const total = cache.index
          ? getFilterTotal(cache.index.counts, filter)
          : null

        const page =
          total === null
            ? Math.max(1, requestedPage)
            : getLibraryPageNumber(requestedPage, total)

        const cached = readCachedLibraryItems(cache, filter, page)

        set({
          libraryActive: true,
          libraryLoading: !cached,
          libraryError: null,
          librarySearchCountError: null,
          libraryTotal: total,
          isOnline: Boolean(ownerId),
          ...(cached && {
            libraryItems: cached,
            libraryHasLoaded: true,
            libraryPage: page,
            libraryHasNextPage:
              cache.pages.get(filter)?.get(page)?.hasNext ?? false,
          }),
        })

        if (cached) {
          prepareParents(cached)

          return
        }

        const result = await readQueryPage(
          runtime,
          ownerId,
          query,
          filter,
          page,
          cache,
        )

        if (!current() || !result) return

        prepareParents(result.items)

        set({
          libraryItems: result.items,
          libraryHasLoaded: true,
          libraryPage: result.page,
          libraryHasNextPage: result.hasNext,
        })
      } catch (error) {
        if (current()) set({ libraryError: getErrorMessage(error) })
      } finally {
        if (current()) set({ libraryLoading: false })
      }
    },
    refreshLibrary: async () => {
      invalidateData()

      await get().loadLibraryPage()
    },
    invalidateLibraryUpdate: async (id, updatedAt) => {
      // REST 和 Realtime 对同一次数据库时间可使用不同的 UTC 后缀。
      if (updatedAt) {
        const version = updatedAt
          .replace(' ', 'T')
          .replace(/(?:Z|\+00(?::?00)?)$/u, '')

        if (updateVersions.get(id) === version) return

        updateVersions.set(id, version)
      }

      await get().invalidateLibrary()
    },
    invalidateLibrary: async () => {
      if (get().libraryActive) return get().refreshLibrary()

      invalidateData()
    },
    cancelLibraryLoad: () => {
      updateVersions.clear()
      runtime.requestId += 1
      set({ libraryActive: false, libraryLoading: false })
    },
    resetLibraryAccount: (accountId) => {
      updateVersions.clear()
      clearCache(runtime)

      set((state) => ({
        libraryGeneration: state.libraryGeneration + 1,
        libraryAccountId: accountId,
        libraryItems: [],
        libraryParents: {},
        libraryParentErrors: {},
        libraryLoading: true,
        libraryError: null,
        libraryHasLoaded: false,
        libraryHasNextPage: false,
        libraryCountsLoading: true,
        libraryCountsError: null,
        libraryPage: 1,
        libraryTotal: null,
        libraryCounts: null,
        librarySearchCountError: null,
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
