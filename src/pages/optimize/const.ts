import type { ElementType } from 'react'
import type { Severity } from './types'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

export const SCORE_LABELS = {
  job_match: '职位匹配度',
  ats_parsing: 'ATS 解析度',
  format_readability: '格式可读性',
  content_completeness: '内容完整度',
  impact_quantification: '影响力量化',
}

export const severityConfig: Record<Severity, {
  label: string
  icon: ElementType
  textColor: string
  bgColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
}> = {
  high: {
    label: '严重问题',
    icon: AlertCircle,
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50/50 dark:bg-red-950/20',
    borderColor: 'border-red-200/60 dark:border-red-900/40',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
    badgeText: 'text-red-700 dark:text-red-300',
  },
  medium: {
    label: '警告',
    icon: AlertTriangle,
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50/50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200/60 dark:border-amber-900/40',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  low: {
    label: '建议优化',
    icon: Info,
    textColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200/60 dark:border-blue-900/40',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
    badgeText: 'text-blue-700 dark:text-blue-300',
  },
}
