import type {
  CreatedTemplateResume,
  CreateTemplateResumeInput,
  CreationIdentity,
  PreparedResumeCreation,
  ResumeCreationPersistence,
} from '@/lib/resume-template/create/types'
import type { TemplateSource } from '@/lib/resume-template/source/types'
import { create } from 'zustand'
import { isEqual } from 'lodash'
import { persistPreparedResume } from '@/lib/resume-template/create/persist'
import { prepareTemplateResume } from '@/lib/resume-template/create/prepare'
import { CreationOutcomeUnknownError } from '@/lib/resume-template/create/types'

interface CreationState {
  status: 'idle' | 'preparing' | 'saving' | 'error' | 'uncertain' | 'success'
  error: string | null
  prepared: PreparedResumeCreation | null
  result: CreatedTemplateResume | null
  start: (input: CreateTemplateResumeInput) => Promise<CreatedTemplateResume>
  retry: () => Promise<CreatedTemplateResume>
  reset: () => void
}

export function createResumeCreationStore(dependencies: {
  source: TemplateSource
  persistence: ResumeCreationPersistence
  getOwnerId: () => string | null
}) {
  let pending: Promise<CreatedTemplateResume> | null = null

  let request: {
    input: CreateTemplateResumeInput
    identity: CreationIdentity
  } | null = null

  return create<CreationState>((set, get) => {
    const execute = (): Promise<CreatedTemplateResume> => {
      if (pending) return pending

      const operation = request

      if (!operation) return Promise.reject(new Error('没有可重试的创建操作'))

      set({ status: get().prepared ? 'saving' : 'preparing', error: null })

      pending = Promise.resolve()
        .then(async () => {
          if (
            operation.input.mode === 'cloud' &&
            dependencies.getOwnerId() !== operation.identity.ownerId
          )
            throw new Error('登录账号已改变，请切回原账号后确认创建结果')

          const prepared =
            get().prepared ??
            (await prepareTemplateResume(
              operation.input,
              dependencies.source,
              operation.identity,
            ))

          set({ prepared, status: 'saving' })

          const result = await persistPreparedResume(
            prepared,
            dependencies.persistence,
          )

          if (
            prepared.mode === 'cloud' &&
            dependencies.getOwnerId() !== prepared.ownerId
          )
            throw new CreationOutcomeUnknownError()

          set({ status: 'success', result, error: null })

          return result
        })
        .catch((error: unknown) => {
          set({
            status:
              error instanceof CreationOutcomeUnknownError
                ? 'uncertain'
                : 'error',
            error: error instanceof Error ? error.message : '创建失败，请重试',
          })

          throw error
        })
        .finally(() => {
          pending = null
        })

      return pending
    }

    return {
      status: 'idle',
      error: null,
      prepared: null,
      result: null,
      start: (input) => {
        const sameOwner =
          request?.identity.ownerId === dependencies.getOwnerId()

        const sameOperation = input.operationId
          ? request?.identity.operationId === input.operationId
          : isEqual(input, request?.input)

        if (pending) {
          if (!sameOwner || !sameOperation)
            return Promise.reject(new Error('上一份简历仍在保存，请稍后重试'))

          return pending
        }
        if (
          sameOwner &&
          sameOperation &&
          (get().status === 'error' || get().status === 'uncertain')
        )
          return execute()

        request = {
          input: structuredClone(input),
          identity: {
            operationId: input.operationId ?? crypto.randomUUID(),
            ownerId: dependencies.getOwnerId(),
          },
        }

        set({ prepared: null, result: null })

        return execute()
      },
      retry: execute,
      reset: () => {
        // 保存结果不确定时保留操作身份；关闭弹窗不能制造下一次重复插入。
        if (pending || (get().prepared && get().status !== 'success')) return

        request = null
        set({ status: 'idle', error: null, prepared: null, result: null })
      },
    }
  })
}
