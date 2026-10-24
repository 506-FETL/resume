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
  star_rewrite: {
    label: 'STAR 化',
    description: '按情境、任务、行动、结果组织内容',
    icon: Sparkles,
  },
  quantify: {
    label: '量化',
    description: '用数量、比例或规模描述成果',
    icon: BarChart3,
  },
  strong_verb: {
    label: '强动词',
    description: '用具体动作替换“负责”“参与”等笼统表述',
    icon: Zap,
  },
  polish: {
    label: '润色',
    description: '精简句子、修正语法和标点',
    icon: Scissors,
  },
  align_jd: {
    label: 'JD 靠拢',
    description: '按目标岗位的关键词调整表述',
    icon: Target,
  },
}

export const SELECTION_MIN_CHARS = 10

export const JD_MIN_CHARS = 10

export const REWRITE_TEMPERATURE = 0.6
