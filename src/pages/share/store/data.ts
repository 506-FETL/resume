import type { ShareDataSlice, ShareSlice } from './types'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'
import { createResumeShare, deleteResumeShare, listAllResumeShares, listResumeShares, pushResumeShareSnapshot, setResumeShareActive, updateResumeShareSettings } from '@/lib/supabase/resume/share'
import { getCurrentUser } from '@/lib/supabase/user'

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

  bootstrapPage: async () => {
    const requestId = get().pageRequestId + 1
    set({
      pageRequestId: requestId,
      pageLoading: true,
      error: null,
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
      })
    }
  },

  reloadPage: async () => get().bootstrapPage(),

  loadShares: async (resumeId) => {
    set({ loading: true, error: null })
    try {
      const shares = await listResumeShares(resumeId)
      if (get().openForResumeId === resumeId)
        set({ shares, loading: false })
    }
    catch (error) {
      if (get().openForResumeId === resumeId) {
        set({
          loading: false,
          error: error instanceof Error ? error.message : '加载失败',
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
    set({ mutatingId: shareId, error: null })
    try {
      await setResumeShareActive(shareId, isActive)
      set(state => ({
        shares: state.shares.map(share => (
          share.id === shareId ? { ...share, is_active: isActive } : share
        )),
        allShares: state.allShares.map(share => (
          share.id === shareId ? { ...share, is_active: isActive } : share
        )),
        mutatingId: null,
      }))
    }
    catch (error) {
      set({
        mutatingId: null,
        error: error instanceof Error ? error.message : '操作失败',
      })
      throw error
    }
  },

  updateSettings: async (shareId, settings) => {
    set({ mutatingId: shareId, error: null })
    try {
      await updateResumeShareSettings(shareId, settings)
      set(state => ({
        shares: state.shares.map(share => (
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
        allShares: state.allShares.map(share => (
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
        mutatingId: null,
      }))
    }
    catch (error) {
      set({
        mutatingId: null,
        error: error instanceof Error ? error.message : '操作失败',
      })
      throw error
    }
  },

  pushSnapshot: async (shareId, snapshot, templateManifest, displayName) => {
    set({ mutatingId: shareId, error: null })
    try {
      await pushResumeShareSnapshot(shareId, snapshot, templateManifest, displayName)
      set(state => ({
        shares: state.shares.map(share => (
          share.id === shareId ? { ...share, display_name: displayName } : share
        )),
        allShares: state.allShares.map(share => (
          share.id === shareId ? { ...share, display_name: displayName } : share
        )),
        mutatingId: null,
      }))
    }
    catch (error) {
      set({
        mutatingId: null,
        error: error instanceof Error ? error.message : '操作失败',
      })
      throw error
    }
  },

  remove: async (shareId) => {
    set({ mutatingId: shareId, error: null })
    try {
      await deleteResumeShare(shareId)
      set(state => ({
        shares: state.shares.filter(share => share.id !== shareId),
        allShares: state.allShares.filter(share => share.id !== shareId),
        actionShare: state.actionShare?.id === shareId ? null : state.actionShare,
        actionTrigger: state.actionShare?.id === shareId ? null : state.actionTrigger,
        mutatingId: null,
      }))
    }
    catch (error) {
      set({
        mutatingId: null,
        error: error instanceof Error ? error.message : '删除失败',
      })
      throw error
    }
  },
})
