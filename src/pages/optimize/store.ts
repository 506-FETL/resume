import type {
  AdvancedToolKey,
  ResumeToolContext,
} from './components/advanced-tools/shared/types'
import type { AnalysisState, AtsCreatePayload, AtsLlmDraft } from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import {
  buildAtsAssessmentInput,
  normalizeAtsEvaluationResult,
} from '@/lib/ats'
import { parseLlmJsonObject, runAtsStructured } from '@/lib/llm'
import { getOfflineResumeById } from '@/lib/offline-resume-manager'
import { createAtsConfig } from '@/lib/supabase/resume'
import { uploadOfflineResumeToCloud } from '@/lib/supabase/resume/form'
import { buildAtsCreatePayload } from '@/lib/supabase/resume/utils'
import useUserStore from '@/store/user'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import { createAtsReports, type AtsReportsState } from './store/reports'
import { createAtsResumeOptions } from './store/resume-options'
import { getErrorMessage } from '@/utils'
import { ANALYSIS_INITIAL_STATE } from './const'
import { fetchResumeDataForAnalysis } from './utils'
import { loadResumeToolContext } from './components/advanced-tools/shared/resume'

interface AtsStore
  extends
    AtsReportsState,
    ReturnType<typeof createAtsReports>,
    ReturnType<typeof createAtsResumeOptions> {
  // Analysis state
  analysisState: AnalysisState
  setAnalysisState: (state: Partial<AnalysisState>) => void
  resetAnalysisState: () => void
  updateLog: (key: string, value: string, append?: boolean) => void

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

    const key = JSON.stringify([resumeId, resumeType, atsConfig?.id, source])

    activeToolKey = key

    if (
      !force &&
      cached?.resumeId === resumeId &&
      cached.resumeType === resumeType &&
      (cached.atsConfig?.id ?? null) === (atsConfig?.id ?? null) &&
      get().advancedToolContextSource === source
    )
      return Promise.resolve(cached)

    const pending = toolRequests.get(key)

    if (pending) return pending

    const isCurrent = reportActions.isReportAccountCurrent()
    const revision = toolRevision

    const request = loadResumeToolContext({ resumeId, resumeType, atsConfig })
      .then((context) => {
        if (
          !isCurrent() ||
          activeToolKey !== key ||
          revision !== toolRevision ||
          (get().currentAtsConfig?.id ?? null) !== (atsConfig?.id ?? null) ||
          get().selectedResumeId !== resumeId ||
          get().selectedResumeType !== resumeType
        )
          return null

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

  const updateLog = (key: string, value: string, append = false) => {
    set((state) => {
      const currentLogs = state.analysisState.logs
      const newLogs = { ...currentLogs }

      if (append && newLogs[key]) {
        newLogs[key] = `${newLogs[key]}\n${value}`
      } else {
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

  const startAnalysis = async (options?: { onComplete?: () => void }) => {
    const { selectedResumeId, selectedResumeType } = get()

    if (!selectedResumeId) {
      toast.error('请先选择一份简历')

      return
    }

    const isCurrent = reportActions.isReportAccountCurrent()

    resetAnalysisState()

    toast.info(
      '分析开始，可能需要一些时间，在此期间你可以随意切换页面，但请不要刷新或关闭浏览器',
    )

    try {
      if (!isCurrent()) return

      let currentResumeId = selectedResumeId
      const currentResumeType = selectedResumeType

      if (currentResumeType === 'offline') {
        setAnalysisState({ status: 'uploading' })
        updateLog('upload', '检测到本地简历，上传至云端...')

        const offlineResume = await getOfflineResumeById(selectedResumeId)

        if (!offlineResume) {
          throw new Error('本地简历不存在')
        }

        if (!isCurrent()) return

        const onlineResume = await uploadOfflineResumeToCloud(
          offlineResume.data,
          {
            display_name: offlineResume.display_name,
            description: '从本地上传的简历',
          },
        )

        if (!onlineResume) {
          throw new Error('上传简历失败')
        }

        if (!isCurrent()) return

        updateLog('upload', '上传成功', true)
        currentResumeId = onlineResume.resume_id
        reportActions.setSelectedResume(currentResumeId, 'online')
      }

      setAnalysisState({ status: 'fetching' })
      updateLog('fetch', '正在获取简历...')

      const resumeData = await fetchResumeDataForAnalysis(
        currentResumeId,
        false,
      )

      if (!isCurrent()) return

      const assessmentInput = buildAtsAssessmentInput(resumeData)

      updateLog('fetch', '准备上传至LLM', true)

      setAnalysisState({ status: 'sending' })
      updateLog('send', '正在上传...')

      // 关键：以 runAtsStructured 的返回值作为权威内容来源（与 jd-variant / ai-rewrite 一致），
      // 回调仅用于驱动流式 UI。此前用节流回调闭包重建 finalContent，会因 throttle/flush 时序
      // 丢失最后一段内容而误报「未返回有效内容」。
      const {
        content: finalContent,
        reasoning: finalReasoning,
        finishReason,
      } = await runAtsStructured(
        assessmentInput,
        ({ content: streamContent, reasoning: streamReasoning }) => {
          if (!isCurrent()) return

          if (streamReasoning) {
            setAnalysisState({ status: 'thinking', reasoning: streamReasoning })
            updateLog('send', '已上传，开始思考...')
          }
          if (streamContent) {
            setAnalysisState({ status: 'generating', content: streamContent })
          }
        },
      )

      if (!isCurrent()) return

      if (!finalContent) {
        // 区分两种空内容：模型只产出了思考过程（H1）vs 完全无输出（网络/上游中断）。
        if (finalReasoning) {
          throw new Error(
            'AI 只返回了思考过程，未生成评估结果（模型输出可能超时或被截断），请重新发起分析',
          )
        }

        throw new Error('AI 未返回任何内容，请检查网络后重新发起分析')
      }

      // finish_reason==='length' 表示输出被 token 上限截断，JSON 必然不完整，提前给出可操作的提示。
      if (finishReason === 'length') {
        throw new Error('AI 输出内容过长被截断，评估结果不完整，请重新发起分析')
      }

      setAnalysisState({ status: 'received' })
      updateLog('result', '已收到结果')

      const result = parseLlmJsonObject<AtsLlmDraft>(finalContent)

      const normalizedResult = normalizeAtsEvaluationResult(
        result,
        assessmentInput,
      )

      setAnalysisState({ status: 'saving' })
      updateLog('save', '正在保存分析报告...')

      const payload: AtsCreatePayload = buildAtsCreatePayload(
        normalizedResult,
        currentResumeId,
      )

      const report = await createAtsConfig(payload)

      if (!isCurrent()) return

      reportActions.acceptReport(report)
      updateLog('save', '报告已生成', true)
      toast.success('ATS 分析报告已生成')

      setAnalysisState({ status: 'complete' })
      updateLog('display', '已展示分析结果')
      options?.onComplete?.()
    } catch (error: unknown) {
      if (!isCurrent()) return

      console.error(error)
      toast.error(getErrorMessage(error, '分析过程中发生错误'))
      set({ analysisError: getErrorMessage(error, '分析过程中发生错误') })
      setAnalysisState({ status: 'idle' })
    }
  }

  return {
    loading: true,
    loadError: null,
    analysisError: null,
    currentAtsConfig: null,
    atsConfigs: null,
    selectedResumeId: null,
    selectedResumeType: null,

    analysisState: ANALYSIS_INITIAL_STATE,
    setAnalysisState,
    resetAnalysisState,
    updateLog,

    ...reportActions,
    ...createAtsResumeOptions(set),
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

subscribeResumeReadChanges((resumeId) => {
  const state = useAtsStore.getState()

  state.invalidateResumeOptions()

  if (
    !resumeId ||
    state.selectedResumeId === resumeId ||
    state.advancedToolResumeContext?.resumeId === resumeId
  )
    state.invalidateToolContext()
})

export default useAtsStore
