import { isOfflineResumeId } from '@/lib/resume-id'
import type { GetState, SetState } from './task-state'
import { controllers, makePatch } from './task-state'

export async function markDraftFailed(resumeId: string, message: string) {
  if (isOfflineResumeId(resumeId)) {
    const { markOfflineVariantFailed } =
      await import('@/lib/offline-resume-manager/variants')

    return markOfflineVariantFailed(resumeId, message)
  }

  const { markVariantFailed } = await import('@/lib/supabase/resume/variant')

  return markVariantFailed(resumeId, message)
}

export function createAbortTask(set: SetState, get: GetState) {
  const patch = makePatch(set)

  return (parentResumeId: string) => {
    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)

    const draftResumeId = get().tasks[parentResumeId]?.draftResumeId

    if (draftResumeId)
      markDraftFailed(draftResumeId, '已取消').catch(() => undefined)

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
        const { deleteOfflineDraftVariant } =
          await import('@/lib/offline-resume-manager/variants')

        await deleteOfflineDraftVariant(draftResumeId)
      } else {
        const { deleteDraftVariant } =
          await import('@/lib/supabase/resume/variant')

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
