import type { StoreApi } from 'zustand'
import type {
  HistoryCurrentResume,
  RestoreStrategy,
  VersionMetadataDraft,
} from '../types'
import type { HistoryStoreState } from './types'
import type {
  ResumeHistoryVersionListItem,
  ResumeHistoryVersionRecord,
  ResumeSnapshot,
} from '@/lib/supabase/resume/history'
import useUserStore from '@/store/user'
import { toast } from 'sonner'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import {
  createResumeHistoryVersion,
  deleteResumeHistoryVersion,
  getResumeHistoryResume,
  getResumeHistoryVersionSnapshot,
  listResumeHistoryVersions,
  updateResumeHistoryVersion,
} from '@/lib/supabase/resume/history/queries'
import { restoreResumeHistoryVersion } from '@/lib/supabase/resume/history/restore'
import { createResumeSnapshotHash } from '@/lib/supabase/resume/history/snapshot'
import {
  buildCurrentResume,
  buildResumeSnapshot,
  normalizeHistoryVersion,
  normalizeHistoryVersionListItem,
  toVersionMutationPayload,
} from '../utils'

export interface HistoryDataSlice {
  resetAccount: (accountId: string | null) => void
  resumeId: string | null
  currentResume: HistoryCurrentResume | null
  versions: ResumeHistoryVersionListItem[]
  snapshotGeneration: number
  snapshotCache: Record<number, ResumeSnapshot>
  snapshotErrors: Record<number, string>
  error: string | null
  currentResumeLoading: boolean
  currentResumeError: string | null
  versionsLoading: boolean
  versionsError: string | null
  versionsLoaded: boolean

  init: (resumeId: string | null | undefined) => Promise<void>
  reload: () => Promise<void>
  reloadCurrentResume: () => Promise<void>
  reloadVersions: () => Promise<void>
  loadVersionSnapshot: (id: number) => Promise<ResumeSnapshot | null>
  saveCurrentVersion: (
    draft: VersionMetadataDraft,
  ) => Promise<ResumeHistoryVersionRecord | null>
  updateVersionMetadata: (
    versionId: number,
    draft: VersionMetadataDraft,
  ) => Promise<ResumeHistoryVersionListItem | null>
  restoreVersion: (
    versionId: number,
    strategy: RestoreStrategy,
  ) => Promise<ResumeHistoryVersionRecord | null>
  deleteVersion: (versionId: number) => Promise<boolean>
}

type Set = StoreApi<HistoryStoreState>['setState']

type Get = StoreApi<HistoryStoreState>['getState']

export function createHistoryDataSlice(set: Set, get: Get): HistoryDataSlice {
  let requestId = 0
  let accountId = useUserStore.getState().currentUser?.id ?? null
  const snapshotRequests = new Map<number, Promise<ResumeSnapshot | null>>()

  const isCurrent = (generation: number, resumeId: string | null) =>
    generation === requestId && get().resumeId === resumeId

  const readCurrentResume = async (resumeId: string, generation: number) => {
    set({ currentResumeLoading: true, currentResumeError: null })

    try {
      const resume = await getResumeHistoryResume(resumeId)
      const currentResume = await buildCurrentResume(resume)

      if (!isCurrent(generation, resumeId)) return false

      set({ currentResume, currentResumeLoading: false })

      return true
    } catch (error) {
      if (!isCurrent(generation, resumeId)) return false

      set({
        currentResumeLoading: false,
        currentResumeError:
          error instanceof Error ? error.message : '当前简历加载失败',
      })

      return false
    }
  }

  const readVersions = async (resumeId: string, generation: number) => {
    set({ versionsLoading: true, versionsError: null })

    try {
      const versions = await listResumeHistoryVersions(resumeId)

      if (!isCurrent(generation, resumeId)) return false

      set({
        versions: versions.map(normalizeHistoryVersionListItem),
        snapshotCache: Object.fromEntries(
          Object.entries(get().snapshotCache).filter(([id]) =>
            versions.some((version) => version.id === Number(id)),
          ),
        ),
        versionsLoaded: true,
        versionsLoading: false,
      })

      return true
    } catch (error) {
      if (!isCurrent(generation, resumeId)) return false

      set({
        versionsLoading: false,
        versionsError:
          error instanceof Error ? error.message : '版本记录加载失败',
      })

      return false
    }
  }

  const hydrate = async (resumeId: string, generation: number) => {
    const results = await Promise.all([
      readCurrentResume(resumeId, generation),
      readVersions(resumeId, generation),
    ])

    return results.every(Boolean)
  }

  return {
    resetAccount(nextAccountId) {
      if (accountId === nextAccountId) return

      accountId = nextAccountId
      requestId += 1
      snapshotRequests.clear()

      set({
        snapshotGeneration: requestId,
        resumeId: null,
        currentResume: null,
        versions: [],
        snapshotCache: {},
        snapshotErrors: {},
        error: null,
        currentResumeLoading: false,
        currentResumeError: null,
        versionsLoading: false,
        versionsError: null,
        versionsLoaded: false,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
      })
    },
    resumeId: null,
    currentResume: null,
    versions: [],
    snapshotGeneration: 0,
    snapshotCache: {},
    snapshotErrors: {},
    error: null,
    currentResumeLoading: false,
    currentResumeError: null,
    versionsLoading: false,
    versionsError: null,
    versionsLoaded: false,

    async loadVersionSnapshot(id) {
      const { snapshotCache, resumeId, versions } = get()
      const cached = snapshotCache[id]

      if (cached) return cached
      if (!resumeId || !versions.some((version) => version.id === id))
        return null
      if (snapshotRequests.has(id)) return snapshotRequests.get(id)!

      const generation = requestId
      const snapshotErrors = { ...get().snapshotErrors }

      delete snapshotErrors[id]
      set({ snapshotErrors })

      const current = () =>
        isCurrent(generation, resumeId) &&
        snapshotRequests.get(id) === request &&
        get().versions.some((version) => version.id === id)

      const request = getResumeHistoryVersionSnapshot(id)
        .then((raw) => {
          if (!current()) return null

          const snapshot = buildResumeSnapshot(raw)

          set((state) => ({
            snapshotCache: { ...state.snapshotCache, [id]: snapshot },
          }))

          return snapshot
        })
        .catch((error: unknown) => {
          if (current())
            set((state) => ({
              snapshotErrors: {
                ...state.snapshotErrors,
                [id]:
                  error instanceof Error ? error.message : '加载版本内容失败',
              },
            }))

          return null
        })
        .finally(() => {
          if (snapshotRequests.get(id) === request) snapshotRequests.delete(id)
        })

      snapshotRequests.set(id, request)

      return request
    },

    async init(resumeId) {
      const activeRequestId = ++requestId
      const sameResume = get().resumeId === resumeId

      snapshotRequests.clear()

      set({
        snapshotGeneration: activeRequestId,
        resumeId: resumeId ?? null,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
        error: null,
        ...(!sameResume && {
          currentResume: null,
          versions: [],
          versionsLoaded: false,
          snapshotCache: {},
          snapshotErrors: {},
        }),
        currentResumeError: null,
        versionsError: null,
      })

      if (!resumeId || isOfflineResumeId(resumeId)) {
        set({
          currentResumeLoading: false,
          versionsLoading: false,
          error: resumeId
            ? '当前仅支持查看云端简历的版本记录，请先同步到云端。'
            : null,
        })

        return
      }

      await hydrate(resumeId, activeRequestId)
    },

    async reload() {
      const resumeId = get().resumeId

      if (!resumeId) return

      const activeRequestId = ++requestId

      snapshotRequests.clear()
      set({ snapshotGeneration: activeRequestId, error: null })
      await hydrate(resumeId, activeRequestId)
    },

    async reloadCurrentResume() {
      const { resumeId, currentResumeLoading } = get()

      if (!resumeId || currentResumeLoading) return

      await readCurrentResume(resumeId, requestId)
    },

    async reloadVersions() {
      const { resumeId, versionsLoading } = get()

      if (!resumeId || versionsLoading) return

      await readVersions(resumeId, requestId)
    },

    async saveCurrentVersion(draft) {
      const { resumeId, currentResume, versions } = get()

      if (
        !resumeId ||
        !currentResume ||
        !get().versionsLoaded ||
        get().currentResumeLoading ||
        get().versionsLoading ||
        get().currentResumeError ||
        get().versionsError
      )
        return null

      const generation = requestId

      set({ savingCurrent: true })

      try {
        const nextHash = await createResumeSnapshotHash(currentResume.snapshot)

        if (!isCurrent(generation, resumeId)) return null

        const latest = versions[0]

        // 内容与最新版本完全一致 → 不重复保存
        if (latest?.content_hash && latest.content_hash === nextHash) {
          toast.info('内容没有变化，已是最新版本')

          return null
        }

        const created = normalizeHistoryVersion(
          await createResumeHistoryVersion({
            resume_id: resumeId,
            ...toVersionMutationPayload(draft),
            source_type: 'manual',
            snapshot: currentResume.snapshot,
            content_hash: nextHash,
            base_updated_at: currentResume.updatedAt,
          }),
        )

        if (!isCurrent(generation, resumeId)) return null

        // 列表存轻量项，snapshot 进缓存（避免刚保存又要重新拉一次）
        const { snapshot: createdSnapshot, ...createdListItem } = created

        set((state) => ({
          versions: [createdListItem, ...state.versions],
          snapshotCache: {
            ...state.snapshotCache,
            [created.id]: createdSnapshot,
          },
        }))

        toast.success('当前版本已保存')

        return created
      } catch (error) {
        if (!isCurrent(generation, resumeId)) return null

        toast.error(error instanceof Error ? error.message : '保存版本失败')

        return null
      } finally {
        if (isCurrent(generation, resumeId)) set({ savingCurrent: false })
      }
    },

    async updateVersionMetadata(versionId, draft) {
      const versions = get().versions
      const targetVersion = versions.find((version) => version.id === versionId)

      if (!targetVersion) return null

      const generation = requestId
      const resumeId = get().resumeId

      set({ savingMetadata: true })

      try {
        const updated = normalizeHistoryVersionListItem(
          await updateResumeHistoryVersion(
            versionId,
            toVersionMutationPayload(draft),
          ),
        )

        if (!isCurrent(generation, resumeId)) return null

        set((state) => ({
          versions: state.versions.map((version) =>
            version.id === updated.id ? updated : version,
          ),
        }))

        toast.success('版本信息已更新')

        return updated
      } catch (error) {
        if (!isCurrent(generation, resumeId)) return null

        toast.error(error instanceof Error ? error.message : '更新版本信息失败')

        return null
      } finally {
        if (isCurrent(generation, resumeId)) set({ savingMetadata: false })
      }
    },

    async restoreVersion(versionId, strategy) {
      const { resumeId, currentResume, versions } = get()
      const targetVersion = versions.find((version) => version.id === versionId)

      if (
        !resumeId ||
        !currentResume ||
        !targetVersion ||
        get().currentResumeLoading ||
        get().versionsLoading ||
        get().currentResumeError ||
        get().versionsError
      )
        return null

      const generation = requestId

      set({ restoring: true })

      try {
        const targetSnapshot = await get().loadVersionSnapshot(versionId)

        if (!targetSnapshot || !isCurrent(generation, resumeId)) return null

        const restoredVersion = normalizeHistoryVersion(
          await restoreResumeHistoryVersion({
            resumeId,
            targetVersion,
            targetSnapshot,
            currentSnapshot: currentResume.snapshot,
            currentUpdatedAt: currentResume.updatedAt,
            strategy,
          }),
        )

        if (!isCurrent(generation, resumeId)) return null

        const refreshed = await hydrate(resumeId, generation)

        if (!isCurrent(generation, resumeId)) return null
        if (!refreshed)
          throw new Error('版本已恢复，部分内容刷新失败，请重试加载')

        toast.success('已恢复至所选版本')

        return restoredVersion
      } catch (error) {
        if (!isCurrent(generation, resumeId)) return null

        toast.error(error instanceof Error ? error.message : '恢复版本失败')

        return null
      } finally {
        if (isCurrent(generation, resumeId)) set({ restoring: false })
      }
    },

    async deleteVersion(versionId) {
      const versions = get().versions
      const targetVersion = versions.find((version) => version.id === versionId)

      if (!targetVersion) return false

      const generation = requestId
      const resumeId = get().resumeId

      set({ deletingVersionId: versionId })

      try {
        await deleteResumeHistoryVersion(versionId)

        if (!isCurrent(generation, resumeId)) return false

        snapshotRequests.delete(versionId)

        const snapshotCache = { ...get().snapshotCache }

        delete snapshotCache[versionId]

        set({
          snapshotCache,
          versions: versions.filter((version) => version.id !== versionId),
        })

        toast.success(`已删除 V${targetVersion.version_no}`)

        return true
      } catch (error) {
        if (!isCurrent(generation, resumeId)) return false

        toast.error(error instanceof Error ? error.message : '删除版本失败')

        return false
      } finally {
        if (isCurrent(generation, resumeId)) set({ deletingVersionId: null })
      }
    },
  }
}
