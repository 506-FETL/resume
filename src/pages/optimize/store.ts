import type {
  AdvancedToolKey,
  ResumeToolContext,
} from './components/advanced-tools/shared/types'
import type {
  AnalysisState,
  AtsCreatePayload,
  AtsEvaluationResult,
  AtsLlmDraft,
} from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import {
  buildAtsAssessmentInput,
  ensureAtsFindingsHaveSuggestions,
  normalizeAtsEvaluationResult,
} from '@/lib/ats'
import { parseLlmJsonObject, runAtsStructured } from '@/lib/llm'
import { getOfflineResumeById } from '@/lib/offline-resume-manager'
import {
  createAtsConfig,
  getAtsFromUserId,
  updateFixChecklist,
} from '@/lib/supabase/resume'
import { uploadOfflineResumeToCloud } from '@/lib/supabase/resume/form'
import { buildAtsCreatePayload } from '@/lib/supabase/resume/utils'
import { getCurrentUser } from '@/lib/supabase/user'
import { getErrorMessage } from '@/utils'
import { ANALYSIS_INITIAL_STATE } from './const'
import { fetchResumeDataForAnalysis } from './utils'

interface AtsStore {
  atsConfigs: AtsEvaluationResult[] | null
  currentAtsConfig: AtsEvaluationResult | null
  loading: boolean
  loadError: string | null
  analysisError: string | null

  selectedResumeId: string | null
  selectedResumeType: 'online' | 'offline' | null
  setSelectedResume: (id: string, type: 'online' | 'offline') => void

  // Analysis state
  analysisState: AnalysisState
  setAnalysisState: (state: Partial<AnalysisState>) => void
  resetAnalysisState: () => void
  updateLog: (key: string, value: string, append?: boolean) => void

  revertFixChecklist: (id: string) => Promise<void>
  update: <K extends keyof AtsEvaluationResult>(
    key: K,
    value: AtsEvaluationResult[K],
  ) => void
  init: () => Promise<void>
  startAnalysis: (options?: { onComplete?: () => void }) => Promise<void>

  // Advanced tools (P6.2)
  advancedToolActiveTool: AdvancedToolKey | null
  advancedToolOpen: boolean
  advancedToolLoadingContext: boolean
  advancedToolResumeContext: ResumeToolContext | null
  setAdvancedToolActiveTool: (tool: AdvancedToolKey | null) => void
  setAdvancedToolOpen: (open: boolean) => void
  setAdvancedToolLoadingContext: (loading: boolean) => void
  setAdvancedToolResumeContext: (context: ResumeToolContext | null) => void
}

const useAtsStore = create<AtsStore>()((set, get) => {
  let initRequestId = 0
  const init = async () => {
    const requestId = ++initRequestId
    set({ loadError: null })
    try {
      // 已有报告（包括已加载的空列表）时静默刷新，避免重新挂载整页内容。
      if (get().atsConfigs === null && !get().loading) set({ loading: true })

      const rawData = await getAtsFromUserId()
      if (requestId !== initRequestId) return
      const latestByResume = new Map<string, AtsEvaluationResult>()
      for (const config of rawData ?? []) {
        if (!latestByResume.has(config.resume_id))
          latestByResume.set(config.resume_id, config)
      }
      const data = [...latestByResume.values()].map((config) => ({
        ...config,
        findings: ensureAtsFindingsHaveSuggestions(config.findings),
      }))

      const { selectedResumeId } = get()
      set({
        atsConfigs: data,
        currentAtsConfig: selectedResumeId
          ? (data.find((item) => item.resume_id === selectedResumeId) ?? null)
          : (data[0] ?? null),
        loading: false,
      })
    } catch (error: unknown) {
      const user = await getCurrentUser()
      if (requestId !== initRequestId) return
      const current = get().currentAtsConfig
      if (!user || (current && current.user_id !== user.id))
        set({ atsConfigs: null, currentAtsConfig: null })
      toast.error(getErrorMessage(error, '加载失败'))
      set({ loadError: getErrorMessage(error, '加载失败') })
      // 刷新失败保留当前报告；首次加载仍可重试。
    } finally {
      if (requestId === initRequestId && get().loading) set({ loading: false })
    }
  }

  const setSelectedResume = (id: string, type: 'online' | 'offline') => {
    set({ selectedResumeId: id, selectedResumeType: type, analysisError: null })

    // 尝试切换到对应的 ATS Config
    const { atsConfigs } = get()
    if (atsConfigs) {
      const config = atsConfigs.find((c) => c.resume_id === id)
      set({ currentAtsConfig: config || null })
    }
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

  const update = <K extends keyof AtsEvaluationResult>(
    key: K,
    value: AtsEvaluationResult[K],
  ) => {
    const { atsConfigs, currentAtsConfig } = get()

    if (!currentAtsConfig) return

    const nextCurrentAtsConfig = { ...currentAtsConfig, [key]: value }
    const nextAtsConfigs =
      atsConfigs?.map((config) =>
        config.id === currentAtsConfig.id ? nextCurrentAtsConfig : config,
      ) ?? null

    set(() => ({
      currentAtsConfig: nextCurrentAtsConfig,
      atsConfigs: nextAtsConfigs,
    }))
  }

  const revertFixChecklist = async (id: string) => {
    const { currentAtsConfig } = get()

    if (!currentAtsConfig) {
      throw new Error('当前没有 ATS 配置')
    }

    const updatedFixCheckList = currentAtsConfig.fixChecklist.map((item) =>
      item.id === id ? { ...item, isDone: !item.isDone } : item,
    )

    try {
      set(() => ({
        currentAtsConfig: {
          ...currentAtsConfig,
          fixChecklist: updatedFixCheckList,
        },
      }))
      await updateFixChecklist(updatedFixCheckList, currentAtsConfig.id)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '操作失败'))
      set(() => ({ currentAtsConfig }))
    }
  }

  const startAnalysis = async (options?: { onComplete?: () => void }) => {
    const { selectedResumeId, selectedResumeType } = get()

    if (!selectedResumeId) {
      toast.error('请先选择一份简历')
      return
    }

    resetAnalysisState()
    toast.info(
      '分析开始，可能需要一些时间，在此期间你可以随意切换页面，但请不要刷新或关闭浏览器',
    )

    try {
      let currentResumeId = selectedResumeId
      const currentResumeType = selectedResumeType

      if (currentResumeType === 'offline') {
        setAnalysisState({ status: 'uploading' })
        updateLog('upload', '检测到本地简历，上传至云端...')

        const offlineResume = await getOfflineResumeById(selectedResumeId)
        if (!offlineResume) {
          throw new Error('本地简历不存在')
        }

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

        updateLog('upload', '上传成功', true)
        currentResumeId = onlineResume.resume_id
        setSelectedResume(currentResumeId, 'online')
      }

      setAnalysisState({ status: 'fetching' })
      updateLog('fetch', '正在获取简历...')
      const resumeData = await fetchResumeDataForAnalysis(
        currentResumeId,
        false,
      )
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
          if (streamReasoning) {
            setAnalysisState({ status: 'thinking', reasoning: streamReasoning })
            updateLog('send', '已上传，开始思考...')
          }
          if (streamContent) {
            setAnalysisState({ status: 'generating', content: streamContent })
          }
        },
      )

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
      await createAtsConfig(payload)
      updateLog('save', '报告已生成', true)
      toast.success('ATS 分析报告已生成')

      await init()

      setAnalysisState({ status: 'complete' })
      updateLog('display', '已展示分析结果')
      options?.onComplete?.()
    } catch (error: unknown) {
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

    init,
    setSelectedResume,
    revertFixChecklist,
    update,
    startAnalysis,

    advancedToolActiveTool: null,
    advancedToolOpen: false,
    advancedToolLoadingContext: false,
    advancedToolResumeContext: null,
    setAdvancedToolActiveTool: (tool) => set({ advancedToolActiveTool: tool }),
    setAdvancedToolOpen: (open) => set({ advancedToolOpen: open }),
    setAdvancedToolLoadingContext: (loading) =>
      set({ advancedToolLoadingContext: loading }),
    setAdvancedToolResumeContext: (context) =>
      set({ advancedToolResumeContext: context }),
  }
})

export default useAtsStore
