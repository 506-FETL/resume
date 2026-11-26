import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import type { ShareDataSlice, ShareSlice } from '../types'
import {
  addPending,
  mapShareLists,
  matchesManagementPage,
  removePending,
} from './lists'
import { shareReadGeneration } from './requests'
import { SHARE_PAGE_SIZE } from '@/lib/supabase/resume/share/management'
import { invalidateShareVersionPages } from './option-pages'
import { deriveShareStatus, findShareById } from '../../utils'

function assertShareGeneration(generation: number) {
  if (generation !== shareReadGeneration)
    throw new Error('登录状态已变更，请重新加载')
}

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
  function applyShareUpdate(
    shareId: string,
    update: (share: ResumeShareRecord) => ResumeShareRecord,
  ) {
    const state = get()
    const previous = findShareById(state.pageShares, state.shares, shareId)

    if (!previous) {
      state.invalidateManagement()

      return
    }

    const record = update(previous)

    set(
      mapShareLists(state, (share) =>
        share.id === shareId ? update(share) : share,
      ),
    )

    const cards =
      matchesManagementPage(state, previous) !==
      matchesManagementPage(state, record)

    const stats =
      cards ||
      matchesManagementPage(state, previous, 'all') !==
        matchesManagementPage(state, record, 'all') ||
      deriveShareStatus(previous) !== deriveShareStatus(record) ||
      previous.expires_at !== record.expires_at ||
      previous.view_count !== record.view_count

    get().invalidateManagement({ cards, stats })
  }

  return {
    createRelease: async (resumeId, release, options) => {
      const generation = shareReadGeneration

      const { createResumeShareRelease } =
        await import('@/lib/supabase/resume/share/mutations')

      assertShareGeneration(generation)

      const record = await createResumeShareRelease(resumeId, release, options)

      assertShareGeneration(generation)

      if (
        options?.purpose === 'application' &&
        (release === 'saved-current' || release.source.kind === 'current')
      )
        invalidateShareVersionPages(resumeId)

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
        const { setResumeShareActive } =
          await import('@/lib/supabase/resume/share/owner-actions')

        assertShareGeneration(generation)

        const saved = await setResumeShareActive(shareId, isActive)

        assertShareGeneration(generation)
        applyShareUpdate(shareId, (share) => ({ ...share, ...saved }))
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

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        const { updateResumeShareSettings } =
          await import('@/lib/supabase/resume/share/owner-actions')

        assertShareGeneration(generation)
        await updateResumeShareSettings(shareId, settings)

        assertShareGeneration(generation)

        applyShareUpdate(shareId, (share) => ({
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
        }))
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

      set((state) => ({
        pendingShareIds: addPending(state.pendingShareIds, shareId),
      }))

      try {
        const { publishResumeShareRelease } =
          await import('@/lib/supabase/resume/share/release-publication')

        assertShareGeneration(generation)

        const record = await publishResumeShareRelease(shareId, release)

        assertShareGeneration(generation)

        applyShareUpdate(shareId, () => record)
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
        const { archiveResumeShare } =
          await import('@/lib/supabase/resume/share/owner-actions')

        assertShareGeneration(generation)
        await archiveResumeShare(shareId)

        const archivedAt = new Date().toISOString()

        assertShareGeneration(generation)

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
        const { deleteResumeShare } =
          await import('@/lib/supabase/resume/share/owner-actions')

        assertShareGeneration(generation)
        await deleteResumeShare(shareId)

        assertShareGeneration(generation)

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
