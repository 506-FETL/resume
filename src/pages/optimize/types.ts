import type { LucideIcon } from 'lucide-react'
import type { ElementType } from 'react'

export * from '@/lib/schema/ats'

export interface ResumeItem {
  id: string
  name: string
  date: string
  score: number
}

export interface SeverityConfigVariant {
  label: string
  icon: ElementType
  textColor: string
  bgColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
}

// 分析状态类型
export type AnalysisStatus =
  | 'idle'
  | 'uploading'
  | 'fetching'
  | 'sending'
  | 'thinking'
  | 'generating'
  | 'received'
  | 'saving'
  | 'complete'

// 步骤配置接口
export interface StepConfig {
  id: string
  icon: LucideIcon
  label: string
  activeStatus: AnalysisStatus | AnalysisStatus[]
  showCondition?: (state: AnalysisState, resumeType: string | null) => boolean
}

// 分析状态接口
export interface AnalysisState {
  status: AnalysisStatus
  logs: Record<string, string>
  reasoning: string
  content: string
}

// Action 类型
export type AnalysisAction =
  | { type: 'RESET' }
  | { type: 'SET_STATUS'; payload: AnalysisStatus }
  | {
      type: 'UPDATE_LOG'
      payload: { key: string; value: string; append?: boolean }
    }
  | { type: 'SET_REASONING'; payload: string }
  | { type: 'SET_CONTENT'; payload: string }
