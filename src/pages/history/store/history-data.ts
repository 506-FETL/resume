import type { StoreApi } from 'zustand'
import type { HistoryCurrentResume, RestoreStrategy, VersionMetadataDraft } from '../types'
import type { HistoryStoreState } from './types'
import type { ResumeHistoryVersionRecord } from '@/lib/supabase/resume/history'
import { toast } from 'sonner'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { createResumeHistoryVersion, createResumeSnapshotHash, deleteResumeHistoryVersion, getResumeHistoryResume, listResumeHistoryVersions, restoreResumeHistoryVersion, updateResumeHistoryVersion } from '@/lib/supabase/resume'
import { buildCurrentResume, normalizeHistoryVersion, toVersionMutationPayload } from '../utils'

export interface HistoryDataSlice {
  resumeId: string | null
  currentResume: HistoryCurrentResume | null
  versions: ResumeHistoryVersionRecord[]
  error: string | null

  init: (resumeId: string | null | undefined) => Promise<void>
  reload: () => Promise<void>
  saveCurrentVersion: (draft: VersionMetadataDraft) => Promise<ResumeHistoryVersionRecord | null>
  updateVersionMetadata: (versionId: number, draft: VersionMetadataDraft) => Promise<ResumeHistoryVersionRecord | null>
  restoreVersion: (versionId: number, strategy: RestoreStrategy) => Promise<ResumeHistoryVersionRecord | null>
  deleteVersion: (versionId: number) => Promise<boolean>
}

type Set = StoreApi<HistoryStoreState>['setState']
type Get = StoreApi<HistoryStoreState>['getState']

export function createHistoryDataSlice(set: Set, get: Get): HistoryDataSlice {
  const hydrate = async (resumeId: string) => {
    const [resume, versions] = await Promise.all([
      getResumeHistoryResume(resumeId),
      listResumeHistoryVersions(resumeId),
    ])

    set({
      currentResume: buildCurrentResume(resume),
      versions: versions.map(normalizeHistoryVersion),
      error: null,
      loading: false,
    })
  }

  return {
    resumeId: null,
    currentResume: null,
    versions: [],
    error: null,

    async init(resumeId) {
      if (!resumeId) {
        set({
          resumeId: null,
          currentResume: null,
          versions: [],
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
          loading: false,
          error: '当前仅支持查看云端简历的版本记录，请先同步到云端。',
        })
        return
      }

      set({
        resumeId,
        currentResume: null,
        versions: [],
        loading: true,
        error: null,
      })

      try {
        await hydrate(resumeId)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : '版本记录加载失败'
        set({
          loading: false,
          error: message,
          currentResume: null,
          versions: [],
        })
        toast.error(message)
      }
    },

    async reload() {
      const resumeId = get().resumeId
      if (!resumeId)
        return

      set({ loading: true })

      try {
        await hydrate(resumeId)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : '版本记录刷新失败'
        set({ loading: false, error: message })
        toast.error(message)
      }
    },

    async saveCurrentVersion(draft) {
      const { resumeId, currentResume, versions } = get()
      if (!resumeId || !currentResume)
        return null

      set({ savingCurrent: true })

      try {
        const nextHash = await createResumeSnapshotHash(currentResume.snapshot)
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

        set({ versions: [created, ...versions] })
        toast.success('当前版本已保存')
        return created
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : '保存版本失败')
        return null
      }
      finally {
        set({ savingCurrent: false })
      }
    },

    async updateVersionMetadata(versionId, draft) {
      const versions = get().versions
      const targetVersion = versions.find(version => version.id === versionId)
      if (!targetVersion)
        return null

      set({ savingMetadata: true })

      try {
        const updated = normalizeHistoryVersion(
          await updateResumeHistoryVersion(versionId, toVersionMutationPayload(draft)),
        )

        set({
          versions: versions.map(version => version.id === updated.id ? updated : version),
        })
        toast.success('版本信息已更新')
        return updated
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : '更新版本信息失败')
        return null
      }
      finally {
        set({ savingMetadata: false })
      }
    },

    async restoreVersion(versionId, strategy) {
      const { resumeId, currentResume, versions } = get()
      const targetVersion = versions.find(version => version.id === versionId)

      if (!resumeId || !currentResume || !targetVersion)
        return null

      set({ restoring: true })

      try {
        const restoredVersion = normalizeHistoryVersion(
          await restoreResumeHistoryVersion({
            resumeId,
            targetVersion,
            currentSnapshot: currentResume.snapshot,
            currentUpdatedAt: currentResume.updatedAt,
            strategy,
          }),
        )

        await hydrate(resumeId)
        toast.success('已恢复至所选版本')
        return restoredVersion
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : '恢复版本失败')
        return null
      }
      finally {
        set({ restoring: false })
      }
    },

    async deleteVersion(versionId) {
      const versions = get().versions
      const targetVersion = versions.find(version => version.id === versionId)
      if (!targetVersion)
        return false

      set({ deletingVersionId: versionId })

      try {
        await deleteResumeHistoryVersion(versionId)
        set({
          versions: versions.filter(version => version.id !== versionId),
        })
        toast.success(`已删除 V${targetVersion.version_no}`)
        return true
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : '删除版本失败')
        return false
      }
      finally {
        set({ deletingVersionId: null })
      }
    },
  }
}
