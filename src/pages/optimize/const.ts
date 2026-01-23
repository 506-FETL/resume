import type { ElementType } from 'react'
import type { Severity, SuggestionKind } from './types'
import type { SkillItem } from '@/lib/schema'
import { AlertCircle, AlertTriangle, Calendar, Info, Tag } from 'lucide-react'

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

export const FIELD_LABEL_MAP: Record<string, string> = {
  // 基本信息
  name: '姓名',
  gender: '性别',
  birthMonth: '出生年月',
  phone: '手机号',
  email: '邮箱',
  workYears: '工作年限',
  maritalStatus: '婚姻状况',
  heightCm: '身高(cm)',
  weightKg: '体重(kg)',
  nation: '民族',
  nativePlace: '籍贯',
  politicalStatus: '政治面貌',
  customFields: '自定义字段',

  // 求职意向
  jobIntent: '求职意向',
  intentionalCity: '意向城市',
  expectedSalary: '期望薪资',
  dateEntry: '到岗时间',

  // 教育背景
  schoolName: '学校名称',
  professional: '专业',
  degree: '学历',
  duration: '时间段',
  eduInfo: '教育经历描述',

  // 工作经历
  companyName: '公司名称',
  position: '职位',
  workDuration: '工作时间',
  workInfo: '工作描述',

  // 项目经历
  projectName: '项目名称',
  participantRole: '担任角色',
  projectDuration: '项目时间',
  projectInfo: '项目描述',

  // 技能特长
  label: '技能名称',
  proficiencyLevel: '熟练度',
  displayType: '展示方式',
  skills: '技能列表',
  description: '描述',

  // 荣誉证书
  certificates: '证书列表',

  // 自我评价
  selfEvaluation: '自我评价',
}

// 熟练度对应百分比
export const PROFICIENCY_MAP: Record<string, number> = {
  一般: 50,
  良好: 65,
  熟练: 80,
  擅长: 85,
  精通: 95,
}

// 编辑器
export const KIND_CONFIG: Record<SuggestionKind, { label: string, color: string, bg: string }> = {
  replace_text: { label: '替换文本', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  replace_value: { label: '替换值', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  fill_field: { label: '填充字段', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  normalize_date: { label: '规范日期', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
}

export const PROFICIENCY_LEVELS = ['一般', '良好', '熟练', '擅长', '精通'] as const
export const DISPLAY_TYPES = [
  { value: 'text', label: '文字' },
  { value: 'percentage', label: '百分比' },
] as const

// 预设技能
export const PRESET_SKILLS = ['JavaScript', 'TypeScript', 'React', 'Vue', 'Node.js', 'Python', 'Java', 'Go', 'SQL', 'Git']

// 预设证书
export const PRESET_CERTIFICATES = ['CET-4', 'CET-6', '计算机二级', '普通话证书', '驾驶证', '教师资格证']

// 渲染器
export const KIND_LABEL_MAP: Record<SuggestionKind, { label: string, icon: typeof Tag }> = {
  replace_text: { label: '文本替换', icon: Tag },
  replace_value: { label: '值替换', icon: Tag },
  fill_field: { label: '字段填充', icon: Tag },
  normalize_date: { label: '日期格式化', icon: Calendar },
}

// 预览渲染器映射
export const PREVIEW_RENDERER_MAP: Record<string, (value: any) => string> = {
  skill_list: (value: SkillItem[]) => value.map(skill => `${skill.label}(${skill.proficiencyLevel})`).join('、'),
  certificate_list: (value: Array<{ name: string }>) => value.map(cert => cert.name).join('、'),
  date_range: (value: string[]) => {
    const [start, end] = value
    return `${start || '未填'} 至 ${end || '至今'}`
  },
  string_array: (value: string[]) => value.join('、'),
  object: (value: any) => {
    const str = JSON.stringify(value)
    return str.slice(0, 100) + (str.length > 100 ? '...' : '')
  },
  object_array: (value: any) => {
    const str = JSON.stringify(value)
    return str.slice(0, 100) + (str.length > 100 ? '...' : '')
  },
}
