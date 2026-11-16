import { getResumeOptions } from '@/lib/supabase/resume/form'
import { listResumeHistoryShareOptions } from '@/lib/supabase/resume/history/queries'
import {
  listAllResumeShares,
  listResumeShares,
} from '@/lib/supabase/resume/share'
import { getCurrentUser } from '@/lib/supabase/user'
import type { ShareDataSlice, ShareSlice, ShareStoreState } from '../types'
import {
  dialogShareRequests,
  shareReadGeneration,
  versionOptionRequests,
} from './requests'

export const createShareReaders: ShareSlice<
  Pick<
    ShareDataSlice,
    | 'bootstrapPage'
    | 'reloadPage'
    | 'reloadResumeOptions'
    | 'loadDialogShares'
    | 'loadVersionOptions'
  >
> = (set, get) => {
  const readPageResource = async (kind: 'shares' | 'resumes') => {
    const shares = kind === 'shares'
    const requestKey = shares ? 'pageRequestId' : 'resumeOptionsRequestId'
    const requestId = get()[requestKey] + 1
    const generation = shareReadGeneration
    const previousShareIds = new Set(get().allShares.map((share) => share.id))

    const current = () =>
      generation === shareReadGeneration && get()[requestKey] === requestId

    set({
      [requestKey]: requestId,
      ...(shares
        ? { pageLoading: true, pageError: null }
        : { resumeOptionsLoading: true, resumeOptionsError: null }),
    })

    try {
      const user = await getCurrentUser()

      if (!current()) return
      if (!user) throw new Error('用户未登录')

      if (get().ownerUserId && get().ownerUserId !== user.id) {
        set({
          shares: [],
          allShares: [],
          resumeMap: {},
          pageLoaded: false,
          resumeOptionsLoaded: false,
          openForResumeId: null,
          openForResumeName: null,
          searchKeyword: '',
          resumeFilters: [],
          statusFilter: 'all',
          versionOptionsByResumeId: {},
        })
      }

      set({ ownerUserId: user.id })

      const result:
        | Pick<ShareStoreState, 'allShares' | 'pageLoaded'>
        | Pick<ShareStoreState, 'resumeMap' | 'resumeOptionsLoaded'> = shares
        ? { allShares: await listAllResumeShares(), pageLoaded: true }
        : {
            resumeMap: Object.fromEntries(
              (await getResumeOptions()).map((resume) => [
                resume.resume_id,
                {
                  resumeId: resume.resume_id,
                  displayName: resume.display_name || '未命名简历',
                  type: resume.type,
                },
              ]),
            ),
            resumeOptionsLoaded: true,
          }

      const currentUser = await getCurrentUser()

      if (!current()) return
      if (!currentUser || currentUser.id !== user.id)
        throw new Error('登录状态已变更，请重新加载')

      if ('allShares' in result) {
        set((state) => {
          // 简历选项先返回时即可创建，列表的旧响应不能抹掉刚创建的链接。
          const created = state.allShares.filter(
            (share) => !previousShareIds.has(share.id),
          )

          const createdIds = new Set(created.map((share) => share.id))

          return {
            ...result,
            allShares: [
              ...created,
              ...result.allShares.filter((share) => !createdIds.has(share.id)),
            ],
          }
        })
      } else {
        set(result)
      }
    } catch (error) {
      if (!current()) return

      const currentUser = await getCurrentUser()

      if (!current()) return

      const keepData = currentUser && currentUser.id === get().ownerUserId

      const message =
        error instanceof Error
          ? error.message
          : shares
            ? '加载分享链接失败'
            : '简历列表加载失败'

      set(
        shares
          ? {
              pageError: message,
              ...(!keepData && { allShares: [], pageLoaded: false }),
            }
          : {
              resumeOptionsError: message,
              ...(!keepData && { resumeMap: {}, resumeOptionsLoaded: false }),
            },
      )
    } finally {
      if (current())
        set(shares ? { pageLoading: false } : { resumeOptionsLoading: false })
    }
  }

  return {
    bootstrapPage: async () => {
      await Promise.all([
        readPageResource('shares'),
        readPageResource('resumes'),
      ])
    },
    reloadPage: async () => readPageResource('shares'),
    reloadResumeOptions: async () => readPageResource('resumes'),
    loadDialogShares: async (resumeId) => {
      const requestId = get().dialogRequestId

      set({
        dialogLoading: true,
        dialogError: null,
      })

      const request =
        dialogShareRequests.get(resumeId) ?? listResumeShares(resumeId)

      dialogShareRequests.set(resumeId, request)

      try {
        const shares = await request

        if (
          get().dialogRequestId === requestId &&
          get().openForResumeId === resumeId
        ) {
          set({
            shares,
            dialogLoading: false,
          })
        }
      } catch (error) {
        if (
          get().dialogRequestId === requestId &&
          get().openForResumeId === resumeId
        ) {
          set({
            dialogLoading: false,
            dialogError: error instanceof Error ? error.message : '加载失败',
          })
        }
      } finally {
        if (dialogShareRequests.get(resumeId) === request)
          dialogShareRequests.delete(resumeId)
      }
    },
    loadVersionOptions: async (resumeId, options) => {
      const activeRequest = versionOptionRequests.get(resumeId)

      if (activeRequest) return activeRequest

      const generation = shareReadGeneration
      const current = get().versionOptionsByResumeId[resumeId]

      if (current?.loaded && !options?.force) return

      const requestId = (current?.requestId ?? 0) + 1

      set((state) => ({
        versionOptionsByResumeId: {
          ...state.versionOptionsByResumeId,
          [resumeId]: {
            items: current?.items ?? [],
            loading: true,
            error: null,
            requestId,
            loaded: current?.loaded ?? false,
          },
        },
      }))

      const request = (async () => {
        try {
          const items = await listResumeHistoryShareOptions(resumeId)

          if (
            shareReadGeneration !== generation ||
            get().versionOptionsByResumeId[resumeId]?.requestId !== requestId
          )
            return

          set((state) => ({
            versionOptionsByResumeId: {
              ...state.versionOptionsByResumeId,
              [resumeId]: {
                items,
                loading: false,
                error: null,
                requestId,
                loaded: true,
              },
            },
          }))
        } catch (error) {
          if (
            shareReadGeneration !== generation ||
            get().versionOptionsByResumeId[resumeId]?.requestId !== requestId
          )
            return

          set((state) => ({
            versionOptionsByResumeId: {
              ...state.versionOptionsByResumeId,
              [resumeId]: {
                items: state.versionOptionsByResumeId[resumeId]?.items ?? [],
                loading: false,
                error:
                  error instanceof Error ? error.message : '历史版本加载失败',
                requestId,
                loaded:
                  state.versionOptionsByResumeId[resumeId]?.loaded ?? false,
              },
            },
          }))
        }
      })()

      versionOptionRequests.set(resumeId, request)

      try {
        await request
      } finally {
        if (versionOptionRequests.get(resumeId) === request)
          versionOptionRequests.delete(resumeId)
      }
    },
  }
}
