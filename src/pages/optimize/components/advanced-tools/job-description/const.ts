import type { ResumeToolContext } from '../shared/types'
import type { JobDescriptionComparisonResult } from './types'
import type { AnalysisState, StepConfig } from '@/pages/optimize/types'
import { Brain, CloudUpload, FileText, Sparkles } from 'lucide-react'
import { ANALYSIS_INITIAL_STATE } from '@/pages/optimize/const'

export interface JobDescriptionToolSession {
  jobDescription: string
  jobDescriptionEdited?: boolean
  result: JobDescriptionComparisonResult | null
  analyzing: boolean
  analysisState: AnalysisState
  analysisOpen: boolean
  analysisError: string | null
}

export const JOB_DESCRIPTION_ANALYSIS_STEPS: StepConfig[] = [
  {
    id: 'send',
    icon: CloudUpload,
    label: '上传当前简历与岗位描述',
    activeStatus: 'sending',
  },
  {
    id: 'thinking',
    icon: Brain,
    label: 'LLM 推导匹配关系',
    activeStatus: 'thinking',
  },
  {
    id: 'result',
    icon: FileText,
    label: '返回结构化分析结果',
    activeStatus: ['generating', 'received'],
  },
  {
    id: 'display',
    icon: Sparkles,
    label: '展示职位描述比对结果',
    activeStatus: 'complete',
  },
] as const

export function createInitialJobDescriptionAnalysisState(): AnalysisState {
  return {
    ...ANALYSIS_INITIAL_STATE,
    logs: {},
  }
}

export function createInitialJobDescriptionToolSession(): JobDescriptionToolSession {
  return {
    jobDescription: '',
    result: null,
    analyzing: false,
    analysisState: createInitialJobDescriptionAnalysisState(),
    analysisOpen: false,
    analysisError: null,
  }
}

export function getJobDescriptionSessionKey(
  resumeId: string,
  resumeType: ResumeToolContext['resumeType'],
) {
  return `${resumeType}:${resumeId}`
}
