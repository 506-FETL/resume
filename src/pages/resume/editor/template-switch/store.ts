import type { TemplateSwitchState } from './types'
import { create } from 'zustand'
import { resolveResumeTemplateBinding } from '@/lib/schema'
import useResumeStore from '@/store/resume/form'
import { useResumeReviewStore } from '../review-store'
import {
  createTemplateSwitchContentKey,
  sameTemplateBinding,
  templateBindingKey,
} from './utils'

function currentSessionKey(): string | null {
  const live = useResumeStore.getState()

  return live.isInitialized &&
    live.currentResumeId &&
    !useResumeReviewStore.getState().active
    ? JSON.stringify([live.currentResumeId, live.documentSessionId, live.mode])
    : null
}

let observedBindingKey = ''
let localWrite: { sessionKey: string; bindingKey: string } | null = null

export const useTemplateSwitchStore = create<TemplateSwitchState>(
  (set, get) => ({
    sessionKey: null,
    open: false,
    selectedBinding: null,
    conflictBinding: null,
    undoRecord: null,
    synchronizeSession: () => {
      const sessionKey = currentSessionKey()
      const binding = useResumeStore.getState().templateBinding
      const bindingKey = templateBindingKey(binding)

      if (sessionKey !== get().sessionKey) {
        observedBindingKey = bindingKey

        set({
          sessionKey,
          open: false,
          selectedBinding: null,
          conflictBinding: null,
          undoRecord: null,
        })

        return
      }
      if (bindingKey !== observedBindingKey) {
        observedBindingKey = bindingKey

        if (
          localWrite?.sessionKey === sessionKey &&
          localWrite.bindingKey === bindingKey
        )
          return

        set({
          undoRecord: null,
          conflictBinding: get().open && binding ? { ...binding } : null,
        })
      }
    },
    openDialog: () => {
      get().synchronizeSession()

      const binding = useResumeStore.getState().templateBinding

      if (!get().sessionKey || !binding) return false

      set({
        open: true,
        selectedBinding: { ...binding },
        conflictBinding: null,
      })

      return true
    },
    closeDialog: () => set({ open: false, conflictBinding: null }),
    selectTemplate: (binding) => {
      get().synchronizeSession()

      if (get().open)
        set({ selectedBinding: resolveResumeTemplateBinding(binding) })
    },
    applyTemplate: ({ binding, contentKey }) => {
      get().synchronizeSession()

      const state = get()
      const live = useResumeStore.getState()

      if (
        !state.open ||
        !state.sessionKey ||
        currentSessionKey() !== state.sessionKey ||
        !sameTemplateBinding(binding, state.selectedBinding) ||
        sameTemplateBinding(binding, live.templateBinding) ||
        contentKey !==
          createTemplateSwitchContentKey(live.getPersistedSnapshot(), binding)
      ) {
        return false
      }

      const applied = resolveResumeTemplateBinding(binding)
      const previous = resolveResumeTemplateBinding(live.templateBinding)

      localWrite = {
        sessionKey: state.sessionKey,
        bindingKey: templateBindingKey(applied),
      }

      try {
        live.setTemplateBinding(applied)

        if (
          currentSessionKey() !== state.sessionKey ||
          !sameTemplateBinding(
            useResumeStore.getState().templateBinding,
            applied,
          )
        )
          return false

        observedBindingKey = templateBindingKey(applied)

        set({
          open: false,
          conflictBinding: null,
          undoRecord: {
            operationId: crypto.randomUUID(),
            sessionKey: state.sessionKey,
            previous,
            applied,
          },
        })

        return true
      } catch {
        get().synchronizeSession()

        if (
          currentSessionKey() === state.sessionKey &&
          sameTemplateBinding(
            useResumeStore.getState().templateBinding,
            previous,
          )
        )
          set({
            conflictBinding: state.conflictBinding,
            undoRecord: state.undoRecord,
          })

        return false
      } finally {
        localWrite = null
      }
    },
    undoTemplate: (operationId) => {
      get().synchronizeSession()

      const record = get().undoRecord
      const live = useResumeStore.getState()

      if (
        !record ||
        (operationId && operationId !== record.operationId) ||
        currentSessionKey() !== record.sessionKey ||
        !sameTemplateBinding(live.templateBinding, record.applied)
      ) {
        return false
      }

      localWrite = {
        sessionKey: record.sessionKey,
        bindingKey: templateBindingKey(record.previous),
      }

      try {
        live.setTemplateBinding(record.previous)

        if (
          currentSessionKey() !== record.sessionKey ||
          !sameTemplateBinding(
            useResumeStore.getState().templateBinding,
            record.previous,
          )
        )
          return false

        observedBindingKey = templateBindingKey(record.previous)
        set({ undoRecord: null })

        return true
      } catch {
        get().synchronizeSession()

        if (
          currentSessionKey() === record.sessionKey &&
          sameTemplateBinding(
            useResumeStore.getState().templateBinding,
            record.applied,
          )
        )
          set({ undoRecord: record })

        return false
      } finally {
        localWrite = null
      }
    },
  }),
)
