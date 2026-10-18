import type { NavigateFunction } from 'react-router-dom'
import type { StoreApi } from 'zustand'
import type { LoadTemplateOptions } from '../shared'
import type { WorkbenchState } from './types'
import { listUserTemplates } from '@/lib/supabase/template'
import useUserStore from '@/store/user'
import { mergeUserTemplates, reconcileLastOpenedUserTemplateId } from '../shared'
import useUserTemplatesStore from '../user-templates'

export interface TemplatesLoaderSlice {
  loading: boolean
  error: string | null
  navigate: NavigateFunction | null
  setNavigate: (navigate: NavigateFunction | null) => void
  loadTemplates: (options?: LoadTemplateOptions) => Promise<void>
}

type Set = StoreApi<WorkbenchState>['setState']

export function createTemplatesLoaderSlice(set: Set): TemplatesLoaderSlice {
  let initialized = false
  let requestId = 0
  let ownerUserId: string | null = null
  return {
    loading: true,
    error: null,
    navigate: null,

    setNavigate: navigate => set({ navigate }),

    loadTemplates: async (options) => {
      const activeRequestId = ++requestId
      const userId = useUserStore.getState().currentUser?.id ?? null
      if (ownerUserId !== userId || !userId) {
        const userStore = useUserTemplatesStore.getState()
        userStore.setUserTemplates([])
        userStore.setLastOpenedUserTemplateId(null)
        ownerUserId = userId
      }
      if (!userId) {
        initialized = true
        set({ loading: false, error: null })
        return
      }
      if (!options?.silent && !initialized)
        set({ loading: true })
      set({ error: null })

      try {
        const userTemplates = await listUserTemplates()
        if (activeRequestId !== requestId || useUserStore.getState().currentUser?.id !== userId)
          return

        const userStore = useUserTemplatesStore.getState()
        const nextUserTemplates = mergeUserTemplates(userTemplates, userStore.userTemplates)

        userStore.setUserTemplates(nextUserTemplates)
        userStore.setLastOpenedUserTemplateId(
          reconcileLastOpenedUserTemplateId(userTemplates, userStore.lastOpenedUserTemplateId),
        )
        initialized = true
      }
      catch (loadError) {
        if (activeRequestId !== requestId || useUserStore.getState().currentUser?.id !== userId)
          return
        set({
          error: loadError instanceof Error ? loadError.message : '加载模板失败',
        })
      }
      finally {
        if (activeRequestId === requestId)
          set({ loading: false })
      }
    },
  }
}
