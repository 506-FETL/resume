import {
  createResumeHistoryVersion,
  deleteResumeHistoryVersion,
  updateResumeHistoryVersion,
} from '@/lib/supabase/resume/history/queries'
import { restoreResumeHistoryVersion } from '@/lib/supabase/resume/history/restore'
import type { ResumeHistoryVersionRecord } from '@/lib/supabase/resume/history/types'
import { toast } from 'sonner'
import {
  normalizeHistoryVersion,
  normalizeHistoryVersionListItem,
  isMetadataDraftDirty,
  toVersionMutationPayload,
} from '../../utils'
import { buildHistoryResumeOption } from '../../utils/versions'
import { isCurrent } from './readers'
import { reconcileVersion } from './timeline-changes'
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
  function addCreatedVersion(created: ResumeHistoryVersionRecord) {
    const { snapshot, ...version } = created

    set((state) => ({
      snapshotCache: { ...state.snapshotCache, [version.id]: snapshot },
    }))

    reconcileVersion(runtime, set, get, { after: version, latest: version })
  }

  return {
    async saveCurrentVersion(draft) {
      const { resumeId, currentResume, latestVersion, versionTotal } = get()

      if (
        !resumeId ||
        !currentResume ||
        !get().versionSummaryReady ||
        versionTotal === null ||
        (versionTotal > 0 && !latestVersion) ||
        get().savingCurrent ||
        get().currentResumeLoading ||
        get().currentResumeError
      )
        return null

      const generation = runtime.requestId

      set({ savingCurrent: true })

      try {
        const nextHash = currentResume.contentHash

        // 内容与最新版本完全一致 → 不重复保存
        if (
          latestVersion?.content_hash &&
          latestVersion.content_hash === nextHash
        ) {
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

        addCreatedVersion(created)

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
      if (!isMetadataDraftDirty(draft, targetVersion)) return targetVersion

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

        reconcileVersion(runtime, set, get, {
          before: targetVersion,
          after: updated,
        })

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
        get().currentResumeError
      )
        return null

      const generation = runtime.requestId

      set({ restoring: true })

      try {
        const targetSnapshot = await get().loadVersionSnapshot(versionId)

        if (!targetSnapshot || !isCurrent(runtime, get, generation, resumeId))
          return null

        const restoredVersion = normalizeHistoryVersion(
          await restoreResumeHistoryVersion(
            {
              resumeId,
              targetVersion,
              targetSnapshot,
              currentSnapshot: currentResume.snapshot,
              currentContentHash: currentResume.contentHash,
              currentUpdatedAt: currentResume.updatedAt,
              strategy,
            },
            {
              backupSaved(record) {
                if (isCurrent(runtime, get, generation, resumeId))
                  addCreatedVersion(normalizeHistoryVersion(record))
              },
              currentSaved(record, snapshot, contentHash) {
                if (isCurrent(runtime, get, generation, resumeId))
                  set({
                    currentResume: {
                      ...buildHistoryResumeOption(record),
                      snapshot,
                      contentHash,
                    },
                  })
              },
            },
          ),
        )

        if (!isCurrent(runtime, get, generation, resumeId)) return null

        addCreatedVersion(restoredVersion)

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

        set({ snapshotCache })
        reconcileVersion(runtime, set, get, { before: targetVersion })

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
