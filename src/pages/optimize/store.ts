import type { AtsEvaluationResult } from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import { getAtsFromUserId, updateFixChecklist } from '@/lib/supabase/resume'

interface AtsStore {
  atsConfigs: AtsEvaluationResult[] | null
  currentAtsConfig: AtsEvaluationResult | null
  loading: boolean

  revertFixChecklist: (id: string) => Promise<void>
  init: () => Promise<void>
}

const useAtsStore = create<AtsStore>()(
  (set, get) => {
    const init = async () => {
      try {
        set({ loading: true })

        const data = await getAtsFromUserId()

        set({ atsConfigs: data })
        set({ currentAtsConfig: data[0] })
      }
      catch (error: any) {
        toast.error(error.message)
        set({ atsConfigs: null })
        set({ currentAtsConfig: null })
      }
      finally {
        set({ loading: false })
      }
    }

    const revertFixChecklist = async (id: string) => {
      const { currentAtsConfig } = get()

      if (!currentAtsConfig) {
        throw new Error('当前没有 ATS 配置')
      }

      const updatedFixCheckList = currentAtsConfig.fixChecklist
        .map(item => item.id === id ? { ...item, isDone: !item.isDone } : item)

      try {
        set(() => ({ currentAtsConfig: { ...currentAtsConfig, fixChecklist: updatedFixCheckList } }))
        await updateFixChecklist(updatedFixCheckList, currentAtsConfig?.id || '')
      }
      catch (error: any) {
        toast.error(error.message)
        set(() => ({ currentAtsConfig }))
      }
    }

    return {
      loading: false,
      currentAtsConfig: null,
      atsConfigs: null,

      init,
      revertFixChecklist,
    }
  },
)

export default useAtsStore
