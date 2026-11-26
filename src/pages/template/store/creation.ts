import type {
  CreateTemplateResumeInput,
  TemplateCreationDraft,
} from '@/lib/resume-template/create/types'
import { create } from 'zustand'
import {
  loadTemplateCreationDraft,
  saveTemplateCreationDraft,
} from '@/lib/resume-preparation/storage'

interface TemplateCreationState {
  key: string | null
  ready: boolean
  draft: TemplateCreationDraft
  saveError: string | null
  load: (key: string) => Promise<void>
  patch: (
    patch: Partial<Pick<TemplateCreationDraft, 'displayName' | 'description'>>,
  ) => void
  setOperation: (
    operation: CreateTemplateResumeInput | undefined,
  ) => Promise<void>
  persist: () => Promise<void>
  discard: () => Promise<void>
}

const emptyDraft = (): TemplateCreationDraft => ({
  displayName: '示例简历',
  description: '',
})

let saveQueue = Promise.resolve()
let generation = 0
let revision = 0
let persistedOperation: CreateTemplateResumeInput | undefined

export const useTemplateCreationDraftStore = create<TemplateCreationState>(
  (set, get) => ({
    key: null,
    ready: false,
    draft: emptyDraft(),
    saveError: null,
    load: async (key) => {
      const current = get()

      if (current.key === key && (current.ready || !current.saveError)) return

      const request = ++generation

      set({ key, ready: false, draft: emptyDraft(), saveError: null })

      try {
        await saveQueue

        const draft = await loadTemplateCreationDraft(key)

        if (request === generation) {
          persistedOperation = draft?.operation
          set({ draft: draft ?? emptyDraft(), ready: true })
        }
      } catch {
        if (request === generation)
          set({ saveError: '无法读取本设备的简历信息，请重新打开后重试。' })
      }
    },
    patch: (patch) => {
      if (!get().ready || get().draft.operation) return

      set({ draft: { ...get().draft, ...patch } })

      get()
        .persist()
        .catch(() => undefined)
    },
    setOperation: async (operation) => {
      // 关闭后立刻重开时，内存里的操作可能还在写盘。只复用已持久化的身份。
      if (
        operation &&
        operation === persistedOperation &&
        operation === get().draft.operation
      )
        return

      set({ draft: { ...get().draft, operation } })
      await get().persist()
      persistedOperation = operation
    },
    persist: () => {
      const { key, draft } = get()
      const request = generation
      const edit = ++revision

      if (!key) return Promise.reject(new Error('简历信息尚未准备好'))

      const pending = saveQueue.then(() =>
        saveTemplateCreationDraft(key, draft),
      )

      saveQueue = pending.catch(() => undefined)

      return pending.then(
        () => {
          if (generation === request && revision === edit)
            set({ saveError: null })
        },
        () => {
          if (generation === request && revision === edit)
            set({ saveError: '简历信息未能保存到本设备，请重试。' })

          throw new Error('简历信息保存失败，请重试')
        },
      )
    },
    discard: async () => {
      const { key } = get()
      const request = generation

      if (!key) return

      const pending = saveQueue.then(() => saveTemplateCreationDraft(key, null))

      saveQueue = pending.catch(() => undefined)
      await pending

      if (generation === request) {
        persistedOperation = undefined
        set({ draft: emptyDraft(), saveError: null })
      }
    },
  }),
)
