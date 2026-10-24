import type { LucideIcon } from 'lucide-react'
import type { AdvancedToolDefinition, AdvancedToolKey } from './types'
import { LayoutTemplate, Maximize2, RefreshCcw, Settings2 } from 'lucide-react'

export interface ToolVisualDefinition extends AdvancedToolDefinition {
  badge: string
  badgeClassName: string
  icon: LucideIcon
  iconClassName: string
}

export const TOOL_DEFINITIONS: ToolVisualDefinition[] = [
  {
    key: 'job-description',
    title: '职位描述比对',
    badge: 'JD Match',
    badgeClassName:
      'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    icon: LayoutTemplate,
    iconClassName:
      'bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  {
    key: 'formatter',
    title: '一键格式化',
    description: '批量应用检测建议，直接修改当前简历。',
    badge: 'Clean Pass',
    badgeClassName:
      'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: RefreshCcw,
    iconClassName:
      'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    key: 'ats-preview',
    title: 'ATS 预览',
    description: '查看简历纯文本和 ATS 解析风险。',
    badge: 'Plain Text',
    badgeClassName:
      'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    icon: Maximize2,
    iconClassName:
      'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  {
    key: 'benchmark',
    title: '行业基准对比',
    description: '按岗位方向对比简历内容指标。',
    badge: 'Role Signal',
    badgeClassName:
      'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    icon: Settings2,
    iconClassName:
      'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
]

export function getToolDefinition(toolKey: AdvancedToolKey | null) {
  if (!toolKey) {
    return null
  }

  return TOOL_DEFINITIONS.find((tool) => tool.key === toolKey) ?? null
}

export function formatToolError(error: unknown) {
  return error instanceof Error ? error.message : '处理失败，请稍后重试'
}
