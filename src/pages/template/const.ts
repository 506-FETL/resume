import type { LucideIcon } from 'lucide-react'
import { FolderOpen, Sparkles } from 'lucide-react'

type TemplateCenterTabKey = 'official' | 'mine'

interface TemplateCenterTabMeta {
  label: string
  description: string
  icon: LucideIcon
}

interface TemplateCenterSummaryItem {
  key: TemplateCenterTabKey
  label: string
  description: string
  icon: LucideIcon
}

export const TEMPLATE_CENTER_TAB_META: Record<TemplateCenterTabKey, TemplateCenterTabMeta> = {
  official: {
    label: '官方',
    description: '从稳定、可直接使用的官方模板快速开始。',
    icon: Sparkles,
  },
  mine: {
    label: '我的',
    description: '沉淀你的常用模板配置，随时继续编辑与复用。',
    icon: FolderOpen,
  },
}

export const TEMPLATE_CENTER_SUMMARY_ITEMS: TemplateCenterSummaryItem[] = [
  {
    key: 'official',
    label: '官方模板',
    description: '可直接使用或进入自定义',
    icon: Sparkles,
  },
  {
    key: 'mine',
    label: '我的模板',
    description: '你保存并可持续维护的模板资产',
    icon: FolderOpen,
  },
]

export const TEMPLATE_SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '申请信息',
  education: '教育经历',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skills: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

export const TEMPLATE_SKELETON_LABELS: Record<string, string> = {
  'single-column': '单栏',
  'sidebar-left': '左侧栏',
  'sidebar-right': '右侧栏',
  'stacked': '分段堆叠',
}

export const TEMPLATE_HEADER_VARIANT_LABELS: Record<string, string> = {
  default: '标准头部',
  compact: '紧凑头部',
  split: '分栏头部',
}

export const TEMPLATE_DENSITY_LABELS: Record<string, string> = {
  compact: '紧凑',
  normal: '标准',
  comfortable: '舒展',
}

export const TEMPLATE_COLOR_PRESET_LABELS: Record<string, string> = {
  default: '默认',
  modern: '现代',
}

export const TEMPLATE_FONT_PRESET_LABELS: Record<string, string> = {
  default: '系统默认',
}

export const TEMPLATE_SPACING_PRESET_LABELS: Record<string, string> = {
  default: '标准',
  compact: '紧凑',
}

export const TEMPLATE_RADIUS_PRESET_LABELS: Record<string, string> = {
  none: '无圆角',
  sm: '小圆角',
}
