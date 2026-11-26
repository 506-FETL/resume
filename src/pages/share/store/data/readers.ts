import { listResumeShares } from '@/lib/supabase/resume/share/records'
import type { ShareDataSlice, ShareSlice } from '../types'
import { dialogShareRequests } from './requests'

export const createShareReaders: ShareSlice<
  Pick<ShareDataSlice, 'loadDialogShares'>
> = (set, get) => ({
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
})
