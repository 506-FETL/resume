import type { GenerateVariantArgs } from '@/components/jd-variant/types'
import useUserStore from '@/store/user'
import { makeIdleTask } from '../types'
import { markDraftFailed } from './task-actions'
import {
  controllers,
  makePatch,
  type GetState,
  type SetState,
} from './task-state'

export function createStartGenerate(set: SetState, get: GetState) {
  const patch = makePatch(set)

  return async (args: GenerateVariantArgs) => {
    const { parentResumeId } = args

    controllers.get(parentResumeId)?.abort()

    const ctrl = new AbortController()
    const ownerId = useUserStore.getState().currentUser?.id ?? null

    const assertOwner = () => {
      if (
        ctrl.signal.aborted ||
        (useUserStore.getState().currentUser?.id ?? null) !== ownerId
      )
        throw new Error('登录状态已改变，请重新发起岗位定制')
    }

    const unsubscribe = useUserStore.subscribe((state) => {
      if ((state.currentUser?.id ?? null) !== ownerId) {
        ctrl.abort()

        patch(parentResumeId, {
          phase: 'aborted',
          errorMessage: '登录状态已改变，请重新发起岗位定制',
        })
      }
    })

    controllers.set(parentResumeId, ctrl)
    patch(parentResumeId, { ...makeIdleTask(parentResumeId), phase: 'parsing' })

    try {
      const { runGeneration } = await import('./run-generation')

      assertOwner()
      await runGeneration(args, get, patch, ctrl, ownerId, assertOwner)
    } catch (err) {
      if (ctrl.signal.aborted) {
        return
      }

      const message = err instanceof Error ? err.message : '派生失败'
      const draftResumeId = get().tasks[parentResumeId]?.draftResumeId

      if (draftResumeId)
        markDraftFailed(draftResumeId, message).catch(() => undefined)

      patch(parentResumeId, { phase: 'error', errorMessage: message })
    } finally {
      unsubscribe()

      if (controllers.get(parentResumeId) === ctrl) {
        controllers.delete(parentResumeId)
      }
    }
  }
}
