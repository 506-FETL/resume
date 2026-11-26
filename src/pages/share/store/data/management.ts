import {
  readShareManagementCounts,
  readShareManagementPage,
  SHARE_PAGE_SIZE,
} from '@/lib/supabase/resume/share/management'
import useUserStore from '@/store/user'
import type { ShareDataSlice, ShareSlice, ShareStoreState } from '../types'
import { clearShareOptionPages } from './option-pages'

type ReadCache<T> = Map<string, T | Promise<T>>

const cardPages: ReadCache<
  Awaited<ReturnType<typeof readShareManagementPage>>
> = new Map()

const summaries: ReadCache<
  Awaited<ReturnType<typeof readShareManagementCounts>>
> = new Map()

let expiresAt = Infinity

export function clearManagementCache() {
  expiresAt = Infinity
  cardPages.clear()
  summaries.clear()
}

function readCached<T>(
  cache: ReadCache<T>,
  key: string,
  read: () => Promise<T>,
) {
  const cached = cache.get(key)

  if (cached) return cached

  const request = read().then((result) => {
    if (cache.get(key) === request) cache.set(key, result)

    return result
  })

  if (cache.size >= 32) cache.delete(cache.keys().next().value!)

  cache.set(key, request)

  return request
}

function getQuery(state: ShareStoreState) {
  const owner = useUserStore.getState().currentUser?.id

  if (!owner) return null
  if (Date.now() >= expiresAt) clearManagementCache()

  const scope = {
    p_keyword: state.pageKeyword,
    p_resume_ids: [...state.resumeFilters].sort(),
  }

  const query = {
    ...scope,
    p_status: state.statusFilter,
    p_page: state.pageNumber,
  }

  return {
    cardsKey: JSON.stringify([owner, query]),
    statsKey: JSON.stringify([owner, scope]),
    readCards: () => readShareManagementPage(query),
    readStats: () => readShareManagementCounts(scope),
  }
}

export function preloadManagement(state: ShareStoreState) {
  const query = getQuery(state)

  if (!query) return

  Promise.resolve(readCached(cardPages, query.cardsKey, query.readCards)).catch(
    () => {},
  )

  Promise.resolve(readCached(summaries, query.statsKey, query.readStats)).catch(
    () => {},
  )
}

type ManagementActions = Pick<
  ShareDataSlice,
  | 'bootstrapPage'
  | 'reloadPage'
  | 'reloadManagementCards'
  | 'reloadManagementStats'
  | 'setPageNumber'
  | 'setPageKeyword'
  | 'invalidateManagement'
  | 'leaveManagement'
>

export const createManagementReaders: ShareSlice<ManagementActions> = (
  set,
  get,
) => {
  const clampPage = () => {
    const state = get()

    if (state.statsLoading || !state.statusCounts || state.statsError) return

    const last = Math.max(
      1,
      Math.ceil(state.statusCounts[state.statusFilter] / SHARE_PAGE_SIZE),
    )

    if (state.pageNumber > last) state.setPageNumber(last)
  }

  const reloadManagementCards = async () => {
    const state = get()
    const query = getQuery(state)

    if (!query || !state.managementOpen) return

    const key = query.cardsKey
    const request = readCached(cardPages, key, query.readCards)
    const requestId = state.pageRequestId + 1

    const identity = {
      pageRequestId: requestId,
      pageQueryKey: key,
      pageError: null,
    }

    try {
      let page

      if (request instanceof Promise) {
        set({
          ...identity,
          pageLoading: true,
          ...(state.pageQueryKey !== key && {
            pageShares: [],
            pageGroups: {},
            pageTotal: null,
            pageLoaded: false,
          }),
        })

        page = await request

        if (!get().managementOpen || get().pageRequestId !== requestId) return
      } else {
        page = request
      }

      const { shares, groups, total } = page

      set({
        ...identity,
        pageShares: shares,
        pageGroups: groups,
        pageTotal: total,
        pageLoaded: true,
        pageLoading: false,
      })

      if (!shares.length) clampPage()
    } catch (cause) {
      if (cardPages.get(key) === request) cardPages.delete(key)
      if (get().managementOpen && get().pageRequestId === requestId)
        set({
          pageError:
            cause instanceof Error ? cause.message : '加载分享链接失败',
          pageLoading: false,
        })
    }
  }

  const reloadManagementStats = async () => {
    const state = get()
    const query = getQuery(state)

    if (!query || !state.managementOpen) return

    const key = query.statsKey
    const requestId = state.statsRequestId + 1

    const identity = {
      countScope: key,
      statsRequestId: requestId,
      statsError: null,
    }

    const request = readCached(summaries, key, query.readStats)

    try {
      let stats

      if (request instanceof Promise) {
        set({
          ...identity,
          statsLoading: true,
          ...(state.countScope !== key && { statusCounts: null }),
        })

        stats = await request

        if (!get().managementOpen || get().statsRequestId !== requestId) return
      } else {
        stats = request
      }

      if (stats.nextExpiry)
        expiresAt = Math.min(expiresAt, Date.parse(stats.nextExpiry))

      set({
        ...identity,
        overview: stats.overview,
        pageStats: stats,
        statusCounts: stats.counts,
        statsLoading: false,
      })

      clampPage()
    } catch (cause) {
      if (summaries.get(key) === request) summaries.delete(key)
      if (get().managementOpen && get().statsRequestId === requestId)
        set({
          statsError:
            cause instanceof Error ? cause.message : '分享统计加载失败',
          statsLoading: false,
        })
    }
  }

  const reloadPage = async () => {
    const state = get()
    const query = getQuery(state)

    if (!query || !state.managementOpen) return

    const stats =
      state.countScope !== query.statsKey ||
      (!state.statsError && !summaries.has(query.statsKey))
        ? reloadManagementStats()
        : undefined

    await Promise.all([reloadManagementCards(), stats])
  }

  return {
    reloadPage,
    reloadManagementCards,
    reloadManagementStats,
    bootstrapPage: async () => {
      set({ managementOpen: true })

      await reloadPage()
    },
    leaveManagement: () => {
      set({ managementOpen: false })

      queueMicrotask(() => {
        if (get().managementOpen) return

        clearManagementCache()
        clearShareOptionPages()
        set({ countScope: null, createDialogOpen: false })
      })
    },
    invalidateManagement: ({ cards = true, stats = true } = {}) => {
      const state = get()

      const query = getQuery(state)

      clearManagementCache()

      if (query && state.managementOpen) {
        if (
          !stats &&
          state.countScope === query.statsKey &&
          state.pageStats &&
          !state.statsError &&
          !state.statsLoading
        ) {
          summaries.set(query.statsKey, state.pageStats)

          if (state.pageStats.nextExpiry)
            expiresAt = Date.parse(state.pageStats.nextExpiry)
        }

        if (
          !cards &&
          state.pageQueryKey === query.cardsKey &&
          state.pageLoaded &&
          !state.pageError &&
          !state.pageLoading
        )
          cardPages.set(query.cardsKey, {
            shares: state.pageShares,
            groups: state.pageGroups,
            total: state.pageTotal,
          })
      }

      if (stats || state.statsLoading || state.statsError)
        reloadManagementStats()
      if (cards || state.pageLoading || state.pageError) reloadManagementCards()
    },
    setPageNumber: (pageNumber) => {
      if (get().pageNumber === pageNumber) return

      set({ pageNumber })
      reloadPage()
    },
    setPageKeyword: (value) => {
      const pageKeyword = value.trim().toLocaleLowerCase()

      if (get().pageKeyword === pageKeyword) return

      set({ pageNumber: 1, pageKeyword })
      reloadPage()
    },
  }
}
