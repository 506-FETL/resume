import type {
  AnalysisAction,
  AnalysisState,
  AnalysisStatus,
  StepConfig,
} from '../types'
import { ANALYSIS_INITIAL_STATE, ANALYSIS_STATUS_ORDER } from '../const'

// Reducer 函数
export function analysisReducer(
  state: AnalysisState,
  action: AnalysisAction,
): AnalysisState {
  switch (action.type) {
    case 'RESET':
      return ANALYSIS_INITIAL_STATE
    case 'SET_STATUS':
      return { ...state, status: action.payload }
    case 'UPDATE_LOG': {
      const { key, value, append } = action.payload

      return {
        ...state,
        logs: {
          ...state.logs,
          [key]: append ? `${state.logs[key] || ''}\n${value}` : value,
        },
      }
    }

    case 'SET_REASONING':
      return { ...state, reasoning: action.payload }
    case 'SET_CONTENT':
      return { ...state, content: action.payload }
    default:
      return state
  }
}

// 获取步骤状态的工具函数
export function getStepStatus(
  stepConfig: StepConfig,
  currentStatus: AnalysisStatus,
  logs: Record<string, string>,
  reasoning: string,
  content: string,
): 'active' | 'complete' | 'pending' {
  const activeStatuses = Array.isArray(stepConfig.activeStatus)
    ? stepConfig.activeStatus
    : [stepConfig.activeStatus]

  // 检查是否是当前活跃状态
  if (activeStatuses.includes(currentStatus)) {
    return 'active'
  }

  // 特殊处理 thinking 步骤 - 检查 reasoning
  if (stepConfig.id === 'thinking' && reasoning) {
    return 'complete'
  }

  // 特殊处理 result 步骤 - 检查 content
  if (stepConfig.id === 'result' && content) {
    return 'complete'
  }

  // 检查是否已完成（通过状态顺序或日志判断）
  const maxActiveStatusOrder = Math.max(
    ...activeStatuses.map((s) => ANALYSIS_STATUS_ORDER[s]),
  )

  if (
    ANALYSIS_STATUS_ORDER[currentStatus] > maxActiveStatusOrder ||
    logs[stepConfig.id]
  ) {
    return 'complete'
  }

  return 'pending'
}

// 获取步骤内容的工具函数
export function getStepContent(
  stepConfig: StepConfig,
  state: AnalysisState,
): string | null {
  const { logs, reasoning, content } = state

  // 根据步骤 ID 返回对应内容
  switch (stepConfig.id) {
    case 'thinking':
      return reasoning || null
    case 'result':
      return content || logs[stepConfig.id] || null
    default:
      return logs[stepConfig.id] || null
  }
}

// 判断步骤是否应该显示内容
export function shouldShowContent(
  stepConfig: StepConfig,
  currentStatus: AnalysisStatus,
  logs: Record<string, string>,
  reasoning: string,
  content: string,
): boolean {
  const stepStatus = getStepStatus(
    stepConfig,
    currentStatus,
    logs,
    reasoning,
    content,
  )

  // 只有当步骤是 active 或 complete 时才显示内容
  return stepStatus === 'active' || stepStatus === 'complete'
}
