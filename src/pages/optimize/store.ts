import type { AnalysisState, AtsEvaluationResult } from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import { getAtsFromUserId, updateFixChecklist } from '@/lib/supabase/resume'
import { ANALYSIS_INITIAL_STATE } from './const'

interface AtsStore {
  atsConfigs: AtsEvaluationResult[] | null
  currentAtsConfig: AtsEvaluationResult | null
  loading: boolean

  selectedResumeId: string | null
  selectedResumeType: 'online' | 'offline' | null
  setSelectedResume: (id: string, type: 'online' | 'offline') => void

  // Analysis state
  analysisState: AnalysisState
  setAnalysisState: (state: Partial<AnalysisState>) => void
  resetAnalysisState: () => void
  updateLog: (key: string, value: string, append?: boolean) => void

  revertFixChecklist: (id: string) => Promise<void>
  update: <K extends keyof AtsEvaluationResult>(key: K, value: AtsEvaluationResult[K]) => void
  init: () => Promise<void>
}

const useAtsStore = create<AtsStore>()(
  (set, get) => {
    const init = async () => {
      try {
        set({ loading: true })

        const data = await getAtsFromUserId()

        set({ atsConfigs: data })
        if (data && data.length > 0) {
          const { selectedResumeId } = get()
          if (selectedResumeId) {
            const matched = data.find(item => item.resume_id === selectedResumeId)
            set({ currentAtsConfig: matched || data[0] })
          }
          else {
            set({ currentAtsConfig: data[0] })
          }
        }
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

    const setSelectedResume = (id: string, type: 'online' | 'offline') => {
      set({ selectedResumeId: id, selectedResumeType: type })

      // 尝试切换到对应的 ATS Config
      const { atsConfigs } = get()
      if (atsConfigs) {
        const config = atsConfigs.find(c => c.resume_id === id)
        set({ currentAtsConfig: config || null })
      }
    }

    const setAnalysisState = (newState: Partial<AnalysisState>) => {
      set(state => ({
        analysisState: { ...state.analysisState, ...newState },
      }))
    }

    const resetAnalysisState = () => {
      set({ analysisState: ANALYSIS_INITIAL_STATE })
    }

    const updateLog = (key: string, value: string, append = false) => {
      set((state) => {
        const currentLogs = state.analysisState.logs
        const newLogs = { ...currentLogs }

        if (append && newLogs[key]) {
          newLogs[key] = `${newLogs[key]}\n${value}`
        }
        else {
          newLogs[key] = value
        }

        return {
          analysisState: {
            ...state.analysisState,
            logs: newLogs,
          },
        }
      })
    }

    const update = <K extends keyof AtsEvaluationResult>(key: K, value: AtsEvaluationResult[K]) => {
      const { currentAtsConfig } = get()

      if (!currentAtsConfig)
        return

      set(() => ({ currentAtsConfig: { ...currentAtsConfig, [key]: value } }))
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
      selectedResumeId: null,
      selectedResumeType: null,

      analysisState: ANALYSIS_INITIAL_STATE,
      setAnalysisState,
      resetAnalysisState,
      updateLog,

      init,
      setSelectedResume,
      revertFixChecklist,
      update,
    }
  },
)

export default useAtsStore
