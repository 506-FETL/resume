import {
  deleteOfflineDraftVariant,
  isOfflineResumeId,
  markOfflineVariantFailed,
} from '@/lib/offline-resume-manager'
import { deleteDraftVariant, markVariantFailed } from '@/lib/supabase/resume'
import type { GetState, SetState } from './task-state'
import { controllers, makePatch } from './task-state'

export function createAbortTask(set: SetState, get: GetState) {
  const patch = makePatch(set)

  return (parentResumeId: string) => {
    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)

    const draftResumeId = get().tasks[parentResumeId]?.draftResumeId

    if (draftResumeId) {
      const fail = isOfflineResumeId(draftResumeId)
        ? markOfflineVariantFailed
        : markVariantFailed

      fail(draftResumeId, '已取消').catch(() => undefined)
    }

    patch(parentResumeId, { phase: 'aborted' })
  }
}

export function createDiscardTask(set: SetState, get: GetState) {
  return async (parentResumeId: string) => {
    const draftResumeId = get().tasks[parentResumeId]?.draftResumeId

    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)

    if (draftResumeId) {
      if (isOfflineResumeId(draftResumeId)) {
        await deleteOfflineDraftVariant(draftResumeId)
      } else {
        await deleteDraftVariant(draftResumeId)
      }
    }

    set((s) => {
      const next = { ...s.tasks }

      delete next[parentResumeId]

      return { tasks: next }
    })
  }
}

export function createClearTask(set: SetState, _get: GetState) {
  return (parentResumeId: string) => {
    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)

    set((s) => {
      const next = { ...s.tasks }

      delete next[parentResumeId]

      return { tasks: next }
    })
  }
}
