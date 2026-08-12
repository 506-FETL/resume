import type { ShareDataSlice, ShareSlice, ShareStoreState } from './types'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'
import { createResumeShare, deleteResumeShare, listAllResumeShares, listResumeShares, pushResumeShareSnapshot, setResumeShareActive, updateResumeShareSettings } from '@/lib/supabase/resume/share'
import { getCurrentUser } from '@/lib/supabase/user'

function addPending(ids: string[], shareId: string) {
  return ids.includes(shareId) ? ids : [...ids, shareId]
}

function removePending(ids: string[], shareId: string) {
  return ids.filter(id => id !== shareId)
}

function mapShareLists(
  state: ShareStoreState,
  updater: (share: ShareStoreState['allShares'][number]) => ShareStoreState['allShares'][number],
) {
  return {
    allShares: state.allShares.map(updater),
    shares: state.shares.map(updater),
  }
}

export const createShareDataSlice: ShareSlice<ShareDataSlice> = (set, get) => ({
  ownerUserId: null,
  pageRequestId: 0,
  shares: [],
  allShares: [],
  resumeMap: {},
  loading: false,
  pageLoading: false,
  mutatingId: null,
  error: null,
  pageError: null,
  dialogLoading: false,
  dialogError: null,
  dialogRequestId: 0,
  pendingShareIds: [],

  bootstrapPage: async () => {
    const requestId = get().pageRequestId + 1
    set({
      pageRequestId: requestId,
      pageLoading: true,
      error: null,
      pageError: null,
      allShares: [],
      resumeMap: {},
      actionShare: null,
    })
    try {
      const user = await getCurrentUser()
      if (!user)
        throw new Error('用户未登录')

      if (get().pageRequestId !== requestId)
        return
      if (get().ownerUserId && get().ownerUserId !== user.id) {
        set({
          shares: [],
          openForResumeId: null,
          openForResumeName: null,
          searchKeyword: '',
          resumeFilters: [],
          statusFilter: 'all',
        })
      }

      const [allShares, resumes] = await Promise.all([
        listAllResumeShares(),
        getAllResumesFromUser(),
      ])
      if (get().pageRequestId !== requestId)
        return
      const currentUser = await getCurrentUser()
      if (!currentUser || currentUser.id !== user.id)
        return
      const resumeMap = Object.fromEntries(
        resumes.map(resume => [
          resume.resume_id,
          {
            resumeId: resume.resume_id,
            displayName: resume.display_name || '未命名简历',
            type: resume.type,
          },
        ]),
      )
      set({
        ownerUserId: user.id,
        allShares,
        resumeMap,
        pageLoading: false,
      })
    }
    catch (error) {
      if (get().pageRequestId !== requestId)
        return
      set({
        ownerUserId: null,
        allShares: [],
        resumeMap: {},
        pageLoading: false,
        error: error instanceof Error ? error.message : '加载分享链接失败',
        pageError: error instanceof Error ? error.message : '加载分享链接失败',
      })
    }
  },

  reloadPage: async () => get().bootstrapPage(),

  loadShares: async resumeId => get().loadDialogShares(resumeId),

  loadDialogShares: async (resumeId) => {
    const requestId = get().dialogRequestId
    set({
      loading: true,
      dialogLoading: true,
      error: null,
      dialogError: null,
    })
    try {
      const shares = await listResumeShares(resumeId)
      if (
        get().dialogRequestId === requestId
        && get().openForResumeId === resumeId
      ) {
        set({
          shares,
          loading: false,
          dialogLoading: false,
        })
      }
    }
    catch (error) {
      if (
        get().dialogRequestId === requestId
        && get().openForResumeId === resumeId
      ) {
        set({
          loading: false,
          dialogLoading: false,
          error: error instanceof Error ? error.message : '加载失败',
          dialogError: error instanceof Error ? error.message : '加载失败',
        })
      }
    }
  },

  create: async (resumeId, snapshot, templateManifest, displayName, options) => {
    set({ error: null })
    try {
      const record = await createResumeShare(resumeId, snapshot, templateManifest, displayName, options)
      set(state => ({
        shares: state.openForResumeId === resumeId
          ? [record, ...state.shares]
          : state.shares,
        allShares: [record, ...state.allShares],
      }))
    }
    catch (error) {
      if (get().openForResumeId === resumeId)
        set({ error: error instanceof Error ? error.message : '创建失败' })
      throw error
    }
  },

  setActive: async (shareId, isActive) => {
    if (get().pendingShareIds.includes(shareId))
      throw new Error('操作正在进行中')

    set(state => ({
      pendingShareIds: addPending(state.pendingShareIds, shareId),
      mutatingId: shareId,
      error: null,
    }))
    try {
      await setResumeShareActive(shareId, isActive)
      set(state => ({
        ...mapShareLists(state, share => (
          share.id === shareId ? { ...share, is_active: isActive } : share
        )),
      }))
    }
    catch (error) {
      set({
        error: error instanceof Error ? error.message : '操作失败',
      })
      throw error
    }
    finally {
      set(state => ({
        pendingShareIds: removePending(state.pendingShareIds, shareId),
        mutatingId: state.mutatingId === shareId ? null : state.mutatingId,
      }))
    }
  },

  updateSettings: async (shareId, settings) => {
    if (get().pendingShareIds.includes(shareId))
      throw new Error('操作正在进行中')

    set(state => ({
      pendingShareIds: addPending(state.pendingShareIds, shareId),
      mutatingId: shareId,
      error: null,
    }))
    try {
      await updateResumeShareSettings(shareId, settings)
      set(state => ({
        ...mapShareLists(state, share => (
          share.id === shareId
            ? {
                ...share,
                label: settings.label,
                expires_at: settings.expiresAt,
                has_password: settings.password === undefined
                  ? share.has_password
                  : Boolean(settings.password),
              }
            : share
        )),
      }))
    }
    catch (error) {
      set({
        error: error instanceof Error ? error.message : '操作失败',
      })
      throw error
    }
    finally {
      set(state => ({
        pendingShareIds: removePending(state.pendingShareIds, shareId),
        mutatingId: state.mutatingId === shareId ? null : state.mutatingId,
      }))
    }
  },

  pushSnapshot: async (shareId, snapshot, templateManifest, displayName) => {
    if (get().pendingShareIds.includes(shareId))
      throw new Error('操作正在进行中')

    set(state => ({
      pendingShareIds: addPending(state.pendingShareIds, shareId),
      mutatingId: shareId,
      error: null,
    }))
    try {
      await pushResumeShareSnapshot(shareId, snapshot, templateManifest, displayName)
      set(state => ({
        ...mapShareLists(state, share => (
          share.id === shareId ? { ...share, display_name: displayName } : share
        )),
      }))
    }
    catch (error) {
      set({
        error: error instanceof Error ? error.message : '操作失败',
      })
      throw error
    }
    finally {
      set(state => ({
        pendingShareIds: removePending(state.pendingShareIds, shareId),
        mutatingId: state.mutatingId === shareId ? null : state.mutatingId,
      }))
    }
  },

  remove: async (shareId) => {
    if (get().pendingShareIds.includes(shareId))
      throw new Error('操作正在进行中')

    set(state => ({
      pendingShareIds: addPending(state.pendingShareIds, shareId),
      mutatingId: shareId,
      error: null,
    }))
    try {
      await deleteResumeShare(shareId)
      set(state => ({
        shares: state.shares.filter(share => share.id !== shareId),
        allShares: state.allShares.filter(share => share.id !== shareId),
        actionShare: state.actionShare?.id === shareId ? null : state.actionShare,
        actionTrigger: state.actionShare?.id === shareId ? null : state.actionTrigger,
        settingsDialogOpen: state.settingsShareId === shareId
          ? false
          : state.settingsDialogOpen,
        deleteDialogOpen: state.deleteShareId === shareId
          ? false
          : state.deleteDialogOpen,
      }))
    }
    catch (error) {
      set({
        error: error instanceof Error ? error.message : '删除失败',
      })
      throw error
    }
    finally {
      set(state => ({
        pendingShareIds: removePending(state.pendingShareIds, shareId),
        mutatingId: state.mutatingId === shareId ? null : state.mutatingId,
      }))
    }
  },
})
