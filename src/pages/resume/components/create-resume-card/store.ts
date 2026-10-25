import type { ImportDraft } from '@/lib/resume-preparation/types'
import type { CreationStep } from './types'
import { create } from 'zustand'
import {
  loadImportDraft,
  saveImportDraft,
} from '@/lib/resume-preparation/storage'
import { emptyDraft } from './utils'

interface CreationDraftState {
  step: CreationStep
  setStep: (step: CreationStep) => void
  scope: string | null
  ready: boolean
  draft: ImportDraft
  saveError: string | null
  saving: boolean
  load: (scope: string) => Promise<void>
  patch: (patch: Partial<ImportDraft>) => void
  persist: () => Promise<void>
  discard: () => Promise<void>
}

let saveQueue = Promise.resolve()
let loadVersion = 0
let editVersion = 0

export const useCreationDraftStore = create<CreationDraftState>((set, get) => ({
  step: 'choose',
  setStep: (step) => set({ step }),
  scope: null,
  ready: false,
  draft: emptyDraft(),
  saveError: null,
  saving: false,
  load: async (scope) => {
    if (get().scope === scope && get().ready) return

    const version = ++loadVersion

    set({ scope, ready: false, draft: emptyDraft(), saveError: null })

    try {
      await saveQueue

      const draft = await loadImportDraft(scope)

      if (version === loadVersion)
        set({ draft: draft ?? emptyDraft(), ready: true })
    } catch {
      if (version === loadVersion)
        set({
          ready: true,
          saveError: '无法读取本设备草稿。可以继续填写，请保持页面打开。',
        })
    }
  },
  patch: (patch) => {
    set({
      draft: { ...get().draft, ...patch, updatedAt: new Date().toISOString() },
    })

    get()
      .persist()
      .catch(() => undefined)
  },
  persist: () => {
    const { scope, draft } = get()
    const version = ++editVersion

    if (!scope) return Promise.reject(new Error('草稿尚未准备好'))

    set({ saving: true })

    const pending = saveQueue
      .catch(() => undefined)
      .then(() => saveImportDraft(scope, draft))

    saveQueue = pending.catch(() => undefined)

    return pending.then(
      () => {
        if (get().scope === scope && version === editVersion)
          set({ saving: false, saveError: null })
      },
      () => {
        if (get().scope === scope && version === editVersion)
          set({
            saving: false,
            saveError: '草稿没有保存到本设备，请重试或先复制原文。',
          })

        throw new Error('草稿保存失败，请重试')
      },
    )
  },
  discard: async () => {
    const scope = get().scope
    const draft = get().draft
    const version = ++editVersion

    if (!scope) return

    set({ draft: emptyDraft(), step: 'choose', saving: true })

    const pending = saveQueue
      .catch(() => undefined)
      .then(() => saveImportDraft(scope, null))

    saveQueue = pending.catch(() => undefined)

    try {
      await pending

      if (get().scope === scope && version === editVersion)
        set({ saving: false, saveError: null })
    } catch {
      if (get().scope === scope && version === editVersion)
        set({ draft, saving: false, saveError: '草稿未能清除，请重试' })

      throw new Error('草稿未能清除，请重试')
    }
  },
}))
