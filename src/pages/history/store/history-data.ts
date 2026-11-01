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
  createResumeSnapshotHash,
  deleteResumeHistoryVersion,
  getResumeHistoryResume,
  getResumeHistoryVersionSnapshot,
  listResumeHistoryVersions,
  restoreResumeHistoryVersion,
  updateResumeHistoryVersion,
} from '@/lib/supabase/resume'
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
  error: string | null

  init: (resumeId: string | null | undefined) => Promise<void>
  reload: () => Promise<void>
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

  const hydrate = async (resumeId: string, activeRequestId?: number) => {
    if (get().resumeId !== resumeId) return

    const hydrationId = activeRequestId ?? ++requestId

    const [resume, versions] = await Promise.all([
      getResumeHistoryResume(resumeId),
      listResumeHistoryVersions(resumeId),
    ])

    const currentResume = await buildCurrentResume(resume)

    if (get().resumeId !== resumeId || hydrationId !== requestId) return

    set({
      currentResume,
      versions: versions.map(normalizeHistoryVersionListItem),
      snapshotCache: Object.fromEntries(
        Object.entries(get().snapshotCache).filter(([id]) =>
          versions.some((version) => version.id === Number(id)),
        ),
      ),
      error: null,
      loading: false,
    })
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
        error: null,
        loading: false,
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
    error: null,

    async loadVersionSnapshot(id) {
      const { snapshotCache, resumeId, versions } = get()
      const cached = snapshotCache[id]

      if (cached) return cached
      if (!resumeId || !versions.some((version) => version.id === id))
        return null
      if (snapshotRequests.has(id)) return snapshotRequests.get(id)!

      const generation = requestId

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
            toast.error(
              error instanceof Error ? error.message : '加载版本内容失败',
            )

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

      snapshotRequests.clear()

      set({
        snapshotGeneration: activeRequestId,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
      })

      if (!resumeId) {
        set({
          resumeId: null,
          currentResume: null,
          versions: [],
          snapshotCache: {},
          loading: false,
          error: null,
        })

        return
      }

      if (isOfflineResumeId(resumeId)) {
        set({
          resumeId,
          currentResume: null,
          versions: [],
          snapshotCache: {},
          loading: false,
          error: '当前仅支持查看云端简历的版本记录，请先同步到云端。',
        })

        return
      }

      const keepData =
        get().resumeId === resumeId && get().currentResume !== null

      set({
        resumeId,
        ...(!keepData && {
          currentResume: null,
          versions: [],
          snapshotCache: {},
        }),
        loading: !keepData,
        error: null,
      })

      try {
        await hydrate(resumeId, activeRequestId)
      } catch (error) {
        if (get().resumeId !== resumeId || activeRequestId !== requestId) return

        const message =
          error instanceof Error ? error.message : '版本记录加载失败'

        set({
          loading: false,
          error: message,
        })

        toast.error(message)
      }
    },

    async reload() {
      const resumeId = get().resumeId

      if (!resumeId) return

      const activeRequestId = ++requestId

      snapshotRequests.clear()

      set({
        snapshotGeneration: activeRequestId,
        loading: get().currentResume === null,
        error: null,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
      })

      try {
        await hydrate(resumeId, activeRequestId)
      } catch (error) {
        if (get().resumeId !== resumeId || activeRequestId !== requestId) return

        const message =
          error instanceof Error ? error.message : '版本记录刷新失败'

        set({ loading: false, error: message })
        toast.error(message)
      }
    },

    async saveCurrentVersion(draft) {
      const { resumeId, currentResume, versions } = get()

      if (!resumeId || !currentResume) return null

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

      if (!resumeId || !currentResume || !targetVersion) return null

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

        await hydrate(resumeId, generation)

        if (!isCurrent(generation, resumeId)) return null

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
