import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  deleteOfflineDraftVariant,
  isOfflineResumeId,
} from '@/lib/offline-resume-manager'
import { deleteDraftVariant } from '@/lib/supabase/resume/variant'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'

type RunningItem =
  | { parentResumeId: string; parentName: string; source: 'store' }
  | {
      parentResumeId: string
      parentName: string
      source: 'db'
      dbResumeId: string
    }

export function useDerivedTasks(
  open: boolean,
  onOpenChange: (next: boolean) => void,
) {
  const list = useResumeListStore()
  const { openDeriveFor } = list
  const resumes = list.libraryActive ? list.libraryPendingItems : list.resumes
  const loading = list.libraryActive ? list.libraryPendingLoading : list.loading

  const loadError = list.libraryActive
    ? list.libraryPendingError
    : list.loadError

  const loadPending = list.libraryActive
    ? list.loadLibraryPendingItems
    : list.loadResumes

  const loadResumes = list.libraryActive
    ? list.refreshLibrary
    : list.loadResumes

  useEffect(() => {
    if (open) loadPending()
  }, [open, loadPending])

  const tasks = useJdVariantStore((s) => s.tasks)
  const discardTask = useJdVariantStore((s) => s.discardTask)
  const runningTabRef = useRef<HTMLButtonElement>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const runningItems = useMemo<RunningItem[]>(() => {
    const resumeNameById = new Map(
      [
        ...Object.values(list.libraryActive ? list.libraryParents : {}),
        ...resumes,
      ]
        .filter((resume) => resume !== null)
        .map((resume) => [resume.resume_id, resume.display_name]),
    )

    const storeRunning: RunningItem[] = Object.values(tasks)
      .filter((t) => t.phase === 'parsing' || t.phase === 'rewriting')
      .map((t) => ({
        parentResumeId: t.parentResumeId,
        parentName: resumeNameById.get(t.parentResumeId) ?? '未命名简历',
        source: 'store',
      }))

    const storeParentIds = new Set(
      storeRunning.map((item) => item.parentResumeId),
    )

    const seen = new Set<string>()
    const dbRunning: RunningItem[] = []

    for (const r of resumes) {
      if (r.derived_status !== 'generating') continue

      const parentId = r.parent_resume_id ?? r.resume_id

      if (storeParentIds.has(r.parent_resume_id ?? '')) continue
      if (seen.has(parentId)) continue

      seen.add(parentId)

      dbRunning.push({
        parentResumeId: parentId,
        parentName:
          resumeNameById.get(r.parent_resume_id ?? '') ?? '未命名简历',
        source: 'db',
        dbResumeId: r.resume_id,
      })
    }

    return [...storeRunning, ...dbRunning]
  }, [tasks, resumes, list.libraryActive, list.libraryParents])

  const failed = useMemo(
    () => resumes.filter((r) => r.derived_status === 'failed'),
    [resumes],
  )

  const discard = async (id: string) => {
    if (isOfflineResumeId(id)) await deleteOfflineDraftVariant(id)
    else await deleteDraftVariant(id)
  }

  const discardRunning = async (item: RunningItem) => {
    if (pendingId) return

    setPendingId(item.parentResumeId)

    try {
      if (item.source === 'db') await discard(item.dbResumeId)
      else await discardTask(item.parentResumeId)

      await loadResumes()
      toast.success('已丢弃草稿')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '丢弃失败，请重试')
    } finally {
      setPendingId(null)
    }
  }

  const handleFailedTask = async (
    id: string,
    retryParentId?: string | null,
  ) => {
    if (pendingId) return

    setPendingId(id)

    try {
      await discard(id)
      await loadResumes()

      if (retryParentId) {
        openDeriveFor(retryParentId)
        onOpenChange(false)
      } else {
        toast.success('已丢弃草稿')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setPendingId(null)
    }
  }

  return {
    resumes,
    loading,
    loadError,
    loadPending,
    runningTabRef,
    pendingId,
    runningItems,
    failed,
    tasks,
    discardRunning,
    handleFailedTask,
    openDeriveFor,
  }
}
