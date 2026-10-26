import type { ResumeCheckIssue } from '@/lib/resume-checks/types'
import { CircleAlert, Info, TriangleAlert } from 'lucide-react'

export const CHECK_LEVELS = {
  error: {
    label: '错误',
    icon: CircleAlert,
    color: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    control:
      'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70',
    highlight: 'rgba(248, 113, 113, 0.38)',
  },
  warning: {
    label: '待核对',
    icon: TriangleAlert,
    color: 'text-amber-700 dark:text-amber-300',
    badge:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    control:
      'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70',
    highlight: 'rgba(250, 204, 21, 0.42)',
  },
  suggestion: {
    label: '建议',
    icon: Info,
    color: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    control:
      'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70',
    highlight: 'rgba(96, 165, 250, 0.36)',
  },
} as const

export function highestCheckSeverity(issues: ResumeCheckIssue[]) {
  return (['error', 'warning', 'suggestion'] as const).find((severity) =>
    issues.some((issue) => !issue.resolved && issue.severity === severity),
  )
}
