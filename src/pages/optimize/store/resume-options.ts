import type { StoreApi } from 'zustand'
import { getErrorMessage } from '@/utils'
import {
  readAtsResumeOptions,
  readSelectedResumeOption,
  type AtsResumeOption,
  type SelectedResumeOption,
} from './picker-queries'

interface ResumeOptionsState {
  resumeOptions: AtsResumeOption[]
  selectedResumeId: string | null
  selectedResumeOption: SelectedResumeOption | null
  resumeOptionsLoading: boolean
  resumeOptionsError: string | null
  resumeOptionsRevision: number
  selectedResumeRevision: number
}

export function createAtsResumeOptions(
  set: StoreApi<ResumeOptionsState>['setState'],
  get: StoreApi<ResumeOptionsState>['getState'],
) {
  let generation = 0
  let selectedGeneration = 0
  let request: Promise<void> | null = null
  let ready = false
  let selectedRequest: { id: string; promise: Promise<void> } | null = null

  return {
    resumeOptions: [] as AtsResumeOption[],
    selectedResumeOption: null as SelectedResumeOption | null,
    resumeOptionsRevision: 0,
    selectedResumeRevision: 0,
    resumeOptionsLoading: true,
    resumeOptionsError: null as string | null,
    loadSelectedResumeOption: async (id: string, local: boolean) => {
      const known =
        ready && get().resumeOptions.find((item) => item.resume_id === id)

      if (known) {
        set({ selectedResumeOption: known })

        return
      }

      if (selectedRequest?.id === id) return selectedRequest.promise

      const scope = selectedGeneration

      const promise = readSelectedResumeOption(id, local)
        .then((option) => {
          if (scope === selectedGeneration && get().selectedResumeId === id)
            set({ selectedResumeOption: option })
        })
        .catch(() => {
          // 打开选择框仍可重新读取名称；当前报告与工具不依赖这次读取。
        })
        .finally(() => {
          if (selectedRequest?.promise === promise) selectedRequest = null
        })

      selectedRequest = { id, promise }

      return promise
    },
    loadResumeOptions: (
      owner: string | null,
      refresh = false,
    ): Promise<void> => {
      if (request) return request
      if (ready && !refresh) return Promise.resolve()

      const scope = generation

      set({ resumeOptionsLoading: true, resumeOptionsError: null })

      const pending = readAtsResumeOptions(owner)
        .then((resumeOptions) => {
          if (scope !== generation) return

          ready = true

          set({
            resumeOptions,
            resumeOptionsLoading: false,
            selectedResumeOption:
              resumeOptions.find(
                (item) => item.resume_id === get().selectedResumeId,
              ) ?? null,
          })
        })
        .catch((error) => {
          if (scope === generation)
            set({
              resumeOptionsError: getErrorMessage(error, '简历列表加载失败'),
              resumeOptionsLoading: false,
            })
        })
        .finally(() => {
          if (request === pending) request = null
        })

      request = pending

      return pending
    },
    invalidateResumeOptions: (resumeId?: string) => {
      generation += 1
      request = null
      ready = false

      if (!resumeId || resumeId === get().selectedResumeId) {
        selectedGeneration += 1
        selectedRequest = null
      }

      set((state) => ({
        resumeOptionsRevision: state.resumeOptionsRevision + 1,
        selectedResumeRevision: selectedGeneration,
      }))
    },
    resetResumeOptions: () => {
      generation += 1
      selectedGeneration += 1
      request = null
      selectedRequest = null
      ready = false

      set({
        resumeOptions: [],
        selectedResumeOption: null,
        selectedResumeRevision: selectedGeneration,
        resumeOptionsLoading: true,
        resumeOptionsError: null,
      })
    },
  }
}
