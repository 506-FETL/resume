import {
  createResumeHistoryVersion,
  deleteResumeHistoryVersion,
  updateResumeHistoryVersion,
} from '@/lib/supabase/resume/history/queries'
import { restoreResumeHistoryVersion } from '@/lib/supabase/resume/history/restore'
import { createResumeSnapshotHash } from '@/lib/supabase/resume/history/snapshot'
import { toast } from 'sonner'
import {
  normalizeHistoryVersion,
  normalizeHistoryVersionListItem,
  toVersionMutationPayload,
} from '../../utils'
import { hydrate, isCurrent } from './readers'
import type { Get, HistoryDataSlice, HistoryRuntime, Set } from './types'

export function createVersionActions(
  runtime: HistoryRuntime,
  set: Set,
  get: Get,
): Pick<
  HistoryDataSlice,
  | 'saveCurrentVersion'
  | 'updateVersionMetadata'
  | 'restoreVersion'
  | 'deleteVersion'
> {
  return {
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

      const generation = runtime.requestId

      set({ savingCurrent: true })

      try {
        const nextHash = await createResumeSnapshotHash(currentResume.snapshot)

        if (!isCurrent(runtime, get, generation, resumeId)) return null

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

        if (!isCurrent(runtime, get, generation, resumeId)) return null

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
        if (!isCurrent(runtime, get, generation, resumeId)) return null

        toast.error(error instanceof Error ? error.message : '保存版本失败')

        return null
      } finally {
        if (isCurrent(runtime, get, generation, resumeId))
          set({ savingCurrent: false })
      }
    },
    async updateVersionMetadata(versionId, draft) {
      const versions = get().versions
      const targetVersion = versions.find((version) => version.id === versionId)

      if (!targetVersion) return null

      const generation = runtime.requestId
      const resumeId = get().resumeId

      set({ savingMetadata: true })

      try {
        const updated = normalizeHistoryVersionListItem(
          await updateResumeHistoryVersion(
            versionId,
            toVersionMutationPayload(draft),
          ),
        )

        if (!isCurrent(runtime, get, generation, resumeId)) return null

        set((state) => ({
          versions: state.versions.map((version) =>
            version.id === updated.id ? updated : version,
          ),
        }))

        toast.success('版本信息已更新')

        return updated
      } catch (error) {
        if (!isCurrent(runtime, get, generation, resumeId)) return null

        toast.error(error instanceof Error ? error.message : '更新版本信息失败')

        return null
      } finally {
        if (isCurrent(runtime, get, generation, resumeId))
          set({ savingMetadata: false })
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

      const generation = runtime.requestId

      set({ restoring: true })

      try {
        const targetSnapshot = await get().loadVersionSnapshot(versionId)

        if (!targetSnapshot || !isCurrent(runtime, get, generation, resumeId))
          return null

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

        if (!isCurrent(runtime, get, generation, resumeId)) return null

        const refreshed = await hydrate(runtime, set, get, resumeId, generation)

        if (!isCurrent(runtime, get, generation, resumeId)) return null
        if (!refreshed)
          throw new Error('版本已恢复，部分内容刷新失败，请重试加载')

        toast.success('已恢复至所选版本')

        return restoredVersion
      } catch (error) {
        if (!isCurrent(runtime, get, generation, resumeId)) return null

        toast.error(error instanceof Error ? error.message : '恢复版本失败')

        return null
      } finally {
        if (isCurrent(runtime, get, generation, resumeId))
          set({ restoring: false })
      }
    },
    async deleteVersion(versionId) {
      const versions = get().versions
      const targetVersion = versions.find((version) => version.id === versionId)

      if (!targetVersion) return false

      const generation = runtime.requestId
      const resumeId = get().resumeId

      set({ deletingVersionId: versionId })

      try {
        await deleteResumeHistoryVersion(versionId)

        if (!isCurrent(runtime, get, generation, resumeId)) return false

        runtime.snapshotRequests.delete(versionId)

        const snapshotCache = { ...get().snapshotCache }

        delete snapshotCache[versionId]

        set({
          snapshotCache,
          versions: versions.filter((version) => version.id !== versionId),
        })

        toast.success(`已删除 V${targetVersion.version_no}`)

        return true
      } catch (error) {
        if (!isCurrent(runtime, get, generation, resumeId)) return false

        toast.error(error instanceof Error ? error.message : '删除版本失败')

        return false
      } finally {
        if (isCurrent(runtime, get, generation, resumeId))
          set({ deletingVersionId: null })
      }
    },
  }
}
