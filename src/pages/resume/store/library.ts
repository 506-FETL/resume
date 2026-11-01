import type { StoreApi } from 'zustand'
import type { ResumeItem } from '../types'
import type { ResumeLibraryCloudCounts } from '@/lib/supabase/resume/library'
import type { ResumeFilterMode } from './resume-ui'
import type { ResumeListState } from './types'
import type { OfflineResumeLibraryIndex } from '@/lib/offline-resume-manager'
import {
  getOfflineResumeLibraryIndex,
  getOfflineResumeSummariesByIds,
} from '@/lib/offline-resume-manager'
import {
  getResumeLibraryCounts,
  getResumeLibraryPage,
  getResumeLibraryParents,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import { getCurrentUser } from '@/lib/supabase/user'
import { getErrorMessage } from '@/utils'

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
  loadLibraryOptions: (force?: boolean) => Promise<void>
  loadLibraryPendingItems: (force?: boolean) => Promise<void>
  loadLibraryOfflineOptions: (force?: boolean) => Promise<void>
}

interface LibraryIndex {
  local: OfflineResumeLibraryIndex
  counts: ResumeLibraryCounts
  cloud: ResumeLibraryCloudCounts
}

interface PageCursor {
  cloudOffset: number
  localOffset: number
  buffer: ResumeItem[]
  localBuffer: ResumeItem[]
}

interface CachedPage {
  items: ResumeItem[]
  next: PageCursor
  ready: boolean
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
  let index: LibraryIndex | null = null
  let indexRequest: Promise<LibraryIndex> | null = null
  let cache = new Map<ResumeFilterMode, Map<number, CachedPage>>()
  let optionsLoaded = false
  let pendingLoaded = false
  let optionsRequest = 0
  let pendingRequest = 0
  let offlineLoaded = false
  let offlineRequest = 0

  async function readIndex(ownerId: string | null) {
    if (index) return index
    if (indexRequest) return indexRequest

    const currentRevision = revision

    const request = Promise.all([
      getOfflineResumeLibraryIndex(),
      ownerId ? getResumeLibraryCounts(ownerId) : EMPTY_CLOUD_COUNTS,
    ]).then(([local, cloud]) => {
      const result: LibraryIndex = {
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

      if (currentRevision === revision) index = result

      return result
    })

    indexRequest = request

    try {
      return await request
    } finally {
      if (indexRequest === request) indexRequest = null
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

      while (ownerId && cloud.length < expected) {
        const batch = await getResumeLibraryPage(ownerId, filter, cloud.length)

        if (!current()) return

        cloud.push(...batch)

        if (batch.length < RESUME_LIBRARY_PAGE_SIZE) break
      }

      const localIds = data.local[filter]

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

      const items = [...cloud, ...local].sort(compareResumes)

      const parents = await readParents(items, ownerId)

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
    index = null
    indexRequest = null
    cache = new Map()
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

      const current = () =>
        request === requestId && currentRevision === revision

      const cachedPage = cache.get(filter)?.get(requestedPage)

      // 账户切换和数据变更会清空缓存；父简历信息补齐后才可直接展示。
      if (index && cachedPage?.ready) {
        set({
          libraryActive: true,
          libraryLoading: false,
          libraryError: null,
          libraryItems: cachedPage.items,
          libraryPage: requestedPage,
          libraryCounts: index.counts,
          libraryTotal: getFilterTotal(index.counts, filter),
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

        const data = await readIndex(ownerId)

        if (!current()) return

        const total = getFilterTotal(data.counts, filter)

        const page = Math.max(
          1,
          Math.min(requestedPage, Math.ceil(total / RESUME_LIBRARY_PAGE_SIZE)),
        )

        const pages = cache.get(filter) ?? new Map<number, CachedPage>()
        const localIds = data.local[filter]

        const cloudTotal =
          filter === 'roots'
            ? data.cloud.roots
            : filter === 'variants'
              ? data.cloud.readyVariants
              : data.cloud.all

        cache.set(filter, pages)

        set({
          libraryCounts: data.counts,
          libraryTotal: total,
          isOnline: Boolean(user),
        })

        for (let target = 1; target <= page; target += 1) {
          if (pages.has(target)) continue

          const previous = pages.get(target - 1)?.next

          const cursor: PageCursor = previous
            ? {
                ...previous,
                buffer: [...previous.buffer],
                localBuffer: [...previous.localBuffer],
              }
            : { cloudOffset: 0, localOffset: 0, buffer: [], localBuffer: [] }

          const remaining = RESUME_LIBRARY_PAGE_SIZE - cursor.buffer.length

          if (ownerId && remaining > 0 && cursor.cloudOffset < cloudTotal) {
            const batch = await getResumeLibraryPage(
              ownerId,
              filter,
              cursor.cloudOffset,
              remaining,
            )

            if (!current()) return

            cursor.buffer.push(...batch)
            cursor.cloudOffset += batch.length
          }

          const localRemaining =
            RESUME_LIBRARY_PAGE_SIZE - cursor.localBuffer.length

          if (localRemaining > 0 && cursor.localOffset < localIds.length) {
            const ids = localIds.slice(
              cursor.localOffset,
              cursor.localOffset + localRemaining,
            )

            const batch = await getOfflineResumeSummariesByIds(ids)

            if (!current()) return

            cursor.localBuffer.push(...batch)
            cursor.localOffset += ids.length
          }

          const items: ResumeItem[] = []

          while (items.length < RESUME_LIBRARY_PAGE_SIZE) {
            const cloud = cursor.buffer[0]
            const offline = cursor.localBuffer[0]

            if (!cloud && !offline) break
            if (offline && (!cloud || compareResumes(offline, cloud) <= 0)) {
              items.push(cursor.localBuffer.shift()!)
            } else {
              items.push(cursor.buffer.shift()!)
            }
          }

          pages.set(target, { items, next: cursor, ready: false })
        }

        const loadedPage = pages.get(page)!
        const items = loadedPage.items
        const parents = await readParents(items, ownerId)

        if (!current()) return

        loadedPage.ready = true

        set((state) => ({
          libraryItems: items,
          libraryParents: { ...state.libraryParents, ...parents },
          libraryPage: page,
        }))
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
          index?.local ?? (await getOfflineResumeLibraryIndex())

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

function getFilterTotal(counts: ResumeLibraryCounts, filter: ResumeFilterMode) {
  return filter === 'roots'
    ? counts.roots
    : filter === 'variants'
      ? counts.readyVariants
      : counts.all
}

function compareResumes(a: ResumeItem, b: ResumeItem) {
  const time =
    (b.updated_at ? new Date(b.updated_at).getTime() : -Infinity) -
    (a.updated_at ? new Date(a.updated_at).getTime() : -Infinity)

  return (
    time || (a.resume_id < b.resume_id ? 1 : a.resume_id > b.resume_id ? -1 : 0)
  )
}
