import type { LucideIcon } from 'lucide-react'
import type { RewriteAction } from './types'
import { BarChart3, Scissors, Sparkles, Target, Zap } from 'lucide-react'

interface ActionMeta {
  label: string
  description: string
  icon: LucideIcon
}

export const REWRITE_ACTION_LIST: RewriteAction[] = [
  'star_rewrite',
  'quantify',
  'strong_verb',
  'polish',
  'align_jd',
]

export const REWRITE_ACTION_META: Record<RewriteAction, ActionMeta> = {
  star_rewrite: { label: 'STAR 化', description: '按 STAR 法则重写，强调情境/任务/动作/结果', icon: Sparkles },
  quantify: { label: '量化', description: '加入百分比/数量/规模等可衡量数据', icon: BarChart3 },
  strong_verb: { label: '强动词', description: '把"负责/参与"等弱动词替换为更专业的强动词', icon: Zap },
  polish: { label: '润色', description: '精简句子、修正语法和标点', icon: Scissors },
  align_jd: { label: 'JD 靠拢', description: '向给定的岗位描述（JD）关键词靠拢', icon: Target },
}

export const SELECTION_MIN_CHARS = 10
export const JD_MIN_CHARS = 10
export const REWRITE_TEMPERATURE = 0.6
