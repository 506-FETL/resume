import {
  readShareManagementCounts,
  readShareManagementPage,
  SHARE_PAGE_SIZE,
  type ShareManagementQuery,
} from '@/lib/supabase/resume/share/management'
import useUserStore from '@/store/user'
import type { ShareDataSlice, ShareSlice } from '../types'
import { shareReadGeneration } from './requests'

const cardPages = new Map<string, ReturnType<typeof readShareManagementPage>>()

const countPages = new Map<
  string,
  ReturnType<typeof readShareManagementCounts>
>()

let expiresAt = Infinity

export function clearManagementCache() {
  expiresAt = Infinity
  cardPages.clear()
  countPages.clear()
}

function readCached<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  read: () => Promise<T>,
) {
  const cached = cache.get(key)

  if (cached) return cached

  const request = read().catch((error) => {
    if (cache.get(key) === request) cache.delete(key)

    throw error
  })

  if (cache.size >= 32) cache.delete(cache.keys().next().value!)

  cache.set(key, request)

  return request
}

type ManagementActions = Pick<
  ShareDataSlice,
  | 'bootstrapPage'
  | 'reloadPage'
  | 'setPageNumber'
  | 'setPageKeyword'
  | 'invalidateManagement'
  | 'leaveManagement'
>

export const createManagementReaders: ShareSlice<ManagementActions> = (
  set,
  get,
) => {
  const reloadPage = async () => {
    const state = get()
    const userId = useUserStore.getState().currentUser?.id

    if (!userId || !state.managementOpen) return

    if (Date.now() >= expiresAt) clearManagementCache()

    const query: ShareManagementQuery = {
      p_keyword: state.pageKeyword,
      p_resume_ids: [...state.resumeFilters].sort(),
      p_status: state.statusFilter,
      p_page: state.pageNumber,
    }

    const countScope = JSON.stringify([
      userId,
      query.p_keyword,
      query.p_resume_ids,
    ])

    const key = JSON.stringify([userId, query])
    const requestId = state.pageRequestId + 1
    const generation = shareReadGeneration

    const current = () =>
      get().pageRequestId === requestId &&
      get().managementOpen &&
      generation === shareReadGeneration

    set({
      pageRequestId: requestId,
      pageQueryKey: key,
      countScope,
      ...(state.countScope !== countScope && { statusCounts: null }),
      pageLoading: true,
      pageError: null,
      statsLoading: true,
      statsError: null,
      ...(state.pageQueryKey !== key && {
        pageShares: [],
        pageLoaded: false,
        pageStats: null,
      }),
    })

    const cards = readCached(cardPages, key, () =>
      readShareManagementPage(query),
    ).then(
      (pageShares) => {
        if (current()) set({ pageShares, pageLoaded: true, pageLoading: false })
      },
      (cause) => {
        if (current())
          set({
            pageError: cause.message || '加载分享链接失败',
            pageLoading: false,
          })
      },
    )

    const counts = readCached(countPages, key, () =>
      readShareManagementCounts(query),
    ).then(
      (pageStats) => {
        if (!current()) return

        if (pageStats.nextExpiry)
          expiresAt = Math.min(expiresAt, Date.parse(pageStats.nextExpiry))

        const last = Math.max(
          1,
          Math.ceil(pageStats.counts[query.p_status] / SHARE_PAGE_SIZE),
        )

        set({
          overview: pageStats.overview,
          pageStats,
          statusCounts: pageStats.counts,
          statsLoading: false,
        })

        if (query.p_page > last) get().setPageNumber(last)
      },
      (cause) => {
        if (current())
          set({
            statsError: cause.message || '分享统计加载失败',
            statsLoading: false,
          })
      },
    )

    await Promise.all([cards, counts])
  }

  return {
    reloadPage,
    bootstrapPage: async () => {
      set({ managementOpen: true })

      await Promise.all([reloadPage(), get().reloadResumeOptions()])
    },
    leaveManagement: () => {
      set({ managementOpen: false })

      queueMicrotask(() => {
        if (!get().managementOpen) clearManagementCache()
      })
    },
    invalidateManagement: (membershipChanged = true) => {
      clearManagementCache()

      if (membershipChanged || get().pageLoading || get().statsLoading)
        reloadPage()
    },
    setPageNumber: (pageNumber) => {
      if (get().pageNumber === pageNumber) return

      set({ pageNumber })
      reloadPage()
    },
    setPageKeyword: (value) => {
      const pageKeyword = value.trim().toLocaleLowerCase()

      if (get().pageKeyword === pageKeyword) return

      clearManagementCache()
      set({ pageNumber: 1, pageKeyword })
      reloadPage()
    },
  }
}
