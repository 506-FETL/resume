import type {
  AdvancedToolKey,
  ResumeToolContext,
} from './components/advanced-tools/shared/types'
import type { AnalysisState } from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import useUserStore from '@/store/user'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import { createAtsReports, type AtsReportsState } from './store/reports'
import { createAtsResumeOptions } from './store/resume-options'
import { getErrorMessage } from '@/utils/error'
import { ANALYSIS_INITIAL_STATE } from './const'

interface AtsStore
  extends
    AtsReportsState,
    ReturnType<typeof createAtsReports>,
    ReturnType<typeof createAtsResumeOptions> {
  // Analysis state
  analysisState: AnalysisState
  setAnalysisState: (state: Partial<AnalysisState>) => void
  resetAnalysisState: () => void

  startAnalysis: (options?: { onComplete?: () => void }) => Promise<void>

  // Advanced tools (P6.2)
  advancedToolActiveTool: AdvancedToolKey | null
  advancedToolOpen: boolean
  advancedToolLoadingContext: boolean
  advancedToolResumeContext: ResumeToolContext | null
  advancedToolContextSource: string | null
  loadAdvancedToolContext: (
    source: string,
    force?: boolean,
  ) => Promise<ResumeToolContext | null>
  resetToolContext: () => void
  invalidateToolContext: () => void
  setAdvancedToolActiveTool: (tool: AdvancedToolKey | null) => void
  setAdvancedToolOpen: (open: boolean) => void
  setAdvancedToolLoadingContext: (loading: boolean) => void
  setAdvancedToolResumeContext: (context: ResumeToolContext | null) => void
}

const useAtsStore = create<AtsStore>()((set, get) => {
  const reportActions = createAtsReports(set, get)
  let activeToolKey: string | null = null
  let toolRevision = 0
  const toolRequests = new Map<string, Promise<ResumeToolContext | null>>()

  const loadAdvancedToolContext = (
    source: string,
    force = false,
  ): Promise<ResumeToolContext | null> => {
    const {
      selectedResumeId: resumeId,
      selectedResumeType: resumeType,
      currentAtsConfig,
      advancedToolResumeContext: cached,
    } = get()

    if (!resumeId || !resumeType)
      return Promise.reject(new Error('请先在上方选择要处理的简历'))

    const atsConfig =
      currentAtsConfig?.resume_id === resumeId ? currentAtsConfig : null

    const key = JSON.stringify([resumeId, resumeType, source])

    activeToolKey = key

    if (
      !force &&
      source &&
      cached?.resumeId === resumeId &&
      cached.resumeType === resumeType &&
      get().advancedToolContextSource === source
    ) {
      const context =
        cached.atsConfig === atsConfig ? cached : { ...cached, atsConfig }

      if (context !== cached) set({ advancedToolResumeContext: context })

      return Promise.resolve(context)
    }

    const pending = toolRequests.get(key)

    if (pending) return pending

    const isCurrent = reportActions.isReportAccountCurrent()
    const revision = toolRevision

    const request = import('./utils/resume-data')
      .then(({ fetchResumeDataForAnalysis }) =>
        fetchResumeDataForAnalysis(resumeId, resumeType === 'offline'),
      )
      .then((resume) => {
        if (
          !isCurrent() ||
          activeToolKey !== key ||
          revision !== toolRevision ||
          get().selectedResumeId !== resumeId ||
          get().selectedResumeType !== resumeType
        )
          return null

        const report = get().currentAtsConfig

        const context = {
          resumeId,
          resumeType,
          resume,
          atsConfig: report?.resume_id === resumeId ? report : null,
        }

        set({
          advancedToolResumeContext: context,
          advancedToolContextSource: source,
        })

        return context
      })
      .catch((error) => {
        if (!isCurrent()) return null

        throw error
      })
      .finally(() => {
        if (toolRequests.get(key) === request) toolRequests.delete(key)
      })

    toolRequests.set(key, request)

    return request
  }

  const setAnalysisState = (newState: Partial<AnalysisState>) => {
    set((state) => ({
      analysisState: { ...state.analysisState, ...newState },
    }))
  }

  const resetAnalysisState = () => {
    set({ analysisState: ANALYSIS_INITIAL_STATE, analysisError: null })
  }

  const startAnalysis = async (options?: { onComplete?: () => void }) => {
    const { selectedResumeId, selectedResumeType, analysisState } = get()

    if (!selectedResumeId || !selectedResumeType) {
      toast.error('请先选择一份简历')

      return
    }
    if (analysisState.status !== 'idle' && analysisState.status !== 'complete')
      return

    const isCurrent = reportActions.isReportAccountCurrent()
    const owner = useUserStore.getState().currentUser?.id

    if (!owner) {
      toast.error('请先登录，再开始检测')

      return
    }

    const offline = selectedResumeType === 'offline'

    set({
      analysisError: null,
      analysisState: {
        ...ANALYSIS_INITIAL_STATE,
        status: offline ? 'uploading' : 'fetching',
        logs: offline
          ? { upload: '正在上传本地简历…' }
          : { fetch: '正在读取简历…' },
      },
    })

    try {
      const { analyzeResume } = await import('./store/analyze-resume')

      if (!isCurrent()) return

      const report = await analyzeResume({
        id: selectedResumeId,
        owner,
        offline,
        isCurrent,
        selectUploaded: (label) => {
          if (get().selectedResumeId === selectedResumeId)
            reportActions.selectUploadedResume(label)
        },
        progress: (partial, logs) => {
          set((state) => ({
            analysisState: {
              ...state.analysisState,
              ...partial,
              ...(logs
                ? { logs: { ...state.analysisState.logs, ...logs } }
                : {}),
            },
          }))
        },
      })

      if (!report || !isCurrent()) return

      reportActions.acceptReport(report)

      setAnalysisState({
        status: 'complete',
        logs: {
          ...get().analysisState.logs,
          save: '报告已生成',
          display: '已展示分析结果',
        },
      })

      toast.success('ATS 分析报告已生成')
      options?.onComplete?.()
    } catch (error) {
      if (!isCurrent()) return

      const message = getErrorMessage(error, '分析过程中发生错误')

      toast.error(message)

      set({
        analysisError: message,
        analysisState: { ...get().analysisState, status: 'idle' },
      })
    }
  }

  return {
    loading: true,
    loadError: null,
    analysisError: null,
    currentAtsConfig: null,
    selectedResumeId: null,
    selectedResumeType: null,

    analysisState: ANALYSIS_INITIAL_STATE,
    setAnalysisState,
    resetAnalysisState,

    ...reportActions,
    ...createAtsResumeOptions(set, get),
    startAnalysis,

    advancedToolActiveTool: null,
    advancedToolOpen: false,
    advancedToolLoadingContext: false,
    advancedToolResumeContext: null,
    advancedToolContextSource: null,
    loadAdvancedToolContext,
    invalidateToolContext: () => {
      toolRevision += 1
      activeToolKey = null
      toolRequests.clear()
      set({ advancedToolContextSource: null })
    },
    resetToolContext: () => {
      toolRevision += 1
      activeToolKey = null
      toolRequests.clear()
      set({ advancedToolResumeContext: null, advancedToolContextSource: null })
    },
    setAdvancedToolActiveTool: (tool) => set({ advancedToolActiveTool: tool }),
    setAdvancedToolOpen: (open) => set({ advancedToolOpen: open }),
    setAdvancedToolLoadingContext: (loading) =>
      set({ advancedToolLoadingContext: loading }),
    setAdvancedToolResumeContext: (context) =>
      set({ advancedToolResumeContext: context }),
  }
})

useUserStore.subscribe((state, previous) => {
  if (state.currentUser?.id === previous.currentUser?.id) return

  useAtsStore.getState().resetReports()
  useAtsStore.getState().resetResumeOptions()
  useAtsStore.getState().resetToolContext()

  useAtsStore.setState({
    analysisState: ANALYSIS_INITIAL_STATE,
    advancedToolActiveTool: null,
    advancedToolOpen: false,
    advancedToolLoadingContext: false,
    advancedToolResumeContext: null,
  })
})

subscribeResumeReadChanges((resumeId, receipt) => {
  const state = useAtsStore.getState()

  const confirmed =
    receipt?.owner === useUserStore.getState().currentUser?.id
      ? receipt?.label
      : undefined

  state.invalidateResumeOptions(resumeId, confirmed)

  if (
    !resumeId ||
    state.selectedResumeId === resumeId ||
    state.advancedToolResumeContext?.resumeId === resumeId
  )
    state.invalidateToolContext()
})

export default useAtsStore
