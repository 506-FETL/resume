import {
  archiveResumeShare,
  createResumeShareRelease,
  deleteResumeShare,
  publishResumeShareRelease,
  setResumeShareActive,
  updateResumeShareSettings,
} from '@/lib/supabase/resume/share'
import type { ShareDataSlice, ShareSlice } from '../types'
import {
  addPending,
  mapShareLists,
  matchesManagementPage,
  removePending,
} from './lists'
import { shareReadGeneration } from './requests'
import { SHARE_PAGE_SIZE } from '@/lib/supabase/resume/share/management'
import { findShareById } from '../../utils'

export const createShareMutations: ShareSlice<
  Pick<
    ShareDataSlice,
    | 'createRelease'
    | 'setActive'
    | 'updateSettings'
    | 'publishRelease'
    | 'archive'
    | 'remove'
  >
> = (set, get) => {
  return {
    createRelease: async (resumeId, release, options) => {
      const generation = shareReadGeneration
      const record = await createResumeShareRelease(resumeId, release, options)

      if (shareReadGeneration !== generation)
        throw new Error('登录状态已变更，请重新加载')

      set((state) => ({
        shares:
          state.openForResumeId === resumeId
            ? [record, ...state.shares]
            : state.shares,
        pageShares:
          state.managementOpen &&
          state.pageNumber === 1 &&
          matchesManagementPage(state, record)
            ? [record, ...state.pageShares].slice(0, SHARE_PAGE_SIZE)
            : state.pageShares,
      }))

      get().invalidateManagement()
    },
    setActive: async (shareId, isActive) => {
      if (get().pendingShareIds.includes(shareId))
        throw new Error('操作正在进行中')

      const generation = shareReadGeneration

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        const savedActive = await setResumeShareActive(shareId, isActive)

        if (shareReadGeneration !== generation)
          throw new Error('登录状态已变更，请重新加载')

        set((state) => ({
          ...mapShareLists(state, (share) =>
            share.id === shareId ? { ...share, is_active: savedActive } : share,
          ),
        }))

        get().invalidateManagement()
      } finally {
        if (shareReadGeneration === generation)
          set((state) => ({
            pendingShareIds: removePending(state.pendingShareIds, shareId),
          }))
      }
    },
    updateSettings: async (shareId, settings) => {
      if (get().pendingShareIds.includes(shareId))
        throw new Error('操作正在进行中')

      const generation = shareReadGeneration
      const { pageShares, shares } = get()
      const previous = findShareById(pageShares, shares, shareId)

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        await updateResumeShareSettings(shareId, settings)

        if (shareReadGeneration !== generation)
          throw new Error('登录状态已变更，请重新加载')

        set((state) => ({
          ...mapShareLists(state, (share) =>
            share.id === shareId
              ? {
                  ...share,
                  label: settings.label,
                  expires_at: settings.expiresAt,
                  has_password:
                    settings.password === undefined
                      ? share.has_password
                      : Boolean(settings.password),
                  allowComments:
                    share.purpose === 'showcase' ||
                    settings.showPhone === false ||
                    settings.showEmail === false
                      ? false
                      : settings.allowComments,
                  showPhone: settings.showPhone ?? share.showPhone,
                  showEmail: settings.showEmail ?? share.showEmail,
                }
              : share,
          ),
        }))

        get().invalidateManagement(
          previous?.label !== settings.label ||
            previous.expires_at !== settings.expiresAt,
        )
      } finally {
        if (shareReadGeneration === generation) {
          set((state) => ({
            pendingShareIds: removePending(state.pendingShareIds, shareId),
          }))
        }
      }
    },
    publishRelease: async (shareId, release) => {
      if (get().pendingShareIds.includes(shareId))
        throw new Error('操作正在进行中')

      const generation = shareReadGeneration
      const { pageShares, shares } = get()
      const previous = findShareById(pageShares, shares, shareId)

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        const record = await publishResumeShareRelease(shareId, release)

        if (shareReadGeneration !== generation)
          throw new Error('登录状态已变更，请重新加载')

        set((state) => ({
          ...mapShareLists(state, (share) =>
            share.id === shareId ? record : share,
          ),
        }))

        get().invalidateManagement(
          previous?.display_name !== record.display_name,
        )
      } finally {
        if (shareReadGeneration === generation)
          set((state) => ({
            pendingShareIds: removePending(state.pendingShareIds, shareId),
          }))
      }
    },
    archive: async (shareId) => {
      if (get().pendingShareIds.includes(shareId))
        throw new Error('操作正在进行中')

      const generation = shareReadGeneration

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        await archiveResumeShare(shareId)

        const archivedAt = new Date().toISOString()

        if (shareReadGeneration !== generation)
          throw new Error('登录状态已变更，请重新加载')

        set((state) => ({
          ...mapShareLists(state, (share) =>
            share.id === shareId
              ? { ...share, archivedAt, is_active: false }
              : share,
          ),
          archiveDialogOpen:
            state.archiveShareId === shareId ? false : state.archiveDialogOpen,
        }))

        get().invalidateManagement()
      } finally {
        if (shareReadGeneration === generation)
          set((state) => ({
            pendingShareIds: removePending(state.pendingShareIds, shareId),
          }))
      }
    },
    remove: async (shareId) => {
      if (get().pendingShareIds.includes(shareId))
        throw new Error('操作正在进行中')

      const generation = shareReadGeneration

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        await deleteResumeShare(shareId)

        if (shareReadGeneration !== generation)
          throw new Error('登录状态已变更，请重新加载')

        set((state) => ({
          shares: state.shares.filter((share) => share.id !== shareId),
          pageShares: state.pageShares.filter((share) => share.id !== shareId),
          settingsDialogOpen:
            state.settingsShareId === shareId
              ? false
              : state.settingsDialogOpen,
          archiveDialogOpen:
            state.archiveShareId === shareId ? false : state.archiveDialogOpen,
          deleteDialogOpen:
            state.deleteShareId === shareId ? false : state.deleteDialogOpen,
          versionDialogOpen:
            state.versionShareId === shareId ? false : state.versionDialogOpen,
        }))

        get().invalidateManagement()
      } finally {
        if (shareReadGeneration === generation)
          set((state) => ({
            pendingShareIds: removePending(state.pendingShareIds, shareId),
          }))
      }
    },
  }
}
