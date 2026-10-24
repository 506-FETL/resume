import type { ToolTone } from './types'
import type { ResumeSchema } from '@/lib/schema'

export const NORMALIZED_PRESENT_TOKENS = new Set([
  '至今',
  '现在',
  'current',
  'present',
])

export const DAYJS_FULL_DATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY-M-D',
  'YYYY/MM/DD',
  'YYYY/M/D',
  'YYYY.MM.DD',
  'YYYY.M.D',
  'YYYY年MM月DD日',
  'YYYY年M月D日',
] as const

export const DAYJS_YEAR_MONTH_FORMATS = [
  'YYYY-MM',
  'YYYY-M',
  'YYYY/MM',
  'YYYY/M',
  'YYYY.MM',
  'YYYY.M',
  'YYYY年MM月',
  'YYYY年M月',
] as const

export const SECTION_LABEL_MAP: Record<keyof ResumeSchema, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '报考信息',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

export const COLLECTION_LABEL_MAP: Record<string, string> = {
  'basics.customFields': '自定义字段',
  'edu_background.items': '教育列表',
  'work_experience.items': '工作列表',
  'internship_experience.items': '实习列表',
  'campus_experience.items': '校园经历列表',
  'project_experience.items': '项目列表',
  'skill_specialty.skills': '技能列表',
  'honors_certificates.certificates': '证书列表',
  'hobbies.hobbies': '爱好列表',
}

export const ITEM_LABEL_PREFIX_MAP: Record<string, string> = {
  'basics.customFields': '自定义字段',
  'edu_background.items': '教育',
  'work_experience.items': '工作',
  'internship_experience.items': '实习',
  'campus_experience.items': '校园',
  'project_experience.items': '项目',
  'skill_specialty.skills': '技能',
  'honors_certificates.certificates': '证书',
  'hobbies.hobbies': '爱好',
}

export const JD_STOPWORDS = new Set([
  '负责',
  '相关',
  '熟悉',
  '了解',
  '优先',
  '能力',
  '经验',
  '工作',
  '岗位',
  '职位',
  '简历',
  '要求',
  '职责',
  '进行',
  '参与',
  '能够',
  '良好',
  '具备',
  '以上',
  '以及',
  '我们',
  '你将',
  '候选人',
  'the',
  'and',
  'for',
  'with',
  'will',
  'you',
  'our',
  'team',
  'from',
  'that',
  'this',
  'have',
  'has',
  'are',
  'your',
])

export const TOOL_TONE_CLASS_MAP: Record<
  ToolTone,
  { badge: string; card: string; icon: string }
> = {
  default: {
    card: 'border-border/60 bg-muted/20',
    icon: 'bg-background text-foreground',
    badge: 'border-border/60 bg-background text-foreground',
  },
  primary: {
    card: 'border-primary/20 bg-primary/5',
    icon: 'bg-primary/10 text-primary',
    badge: 'border-primary/20 bg-primary/10 text-primary',
  },
  success: {
    card: 'border-green-500/20 bg-green-500/5',
    icon: 'bg-green-500/10 text-green-700 dark:text-green-300',
    badge:
      'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300',
  },
  warning: {
    card: 'border-amber-500/20 bg-amber-500/5',
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    badge:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  danger: {
    card: 'border-red-500/20 bg-red-500/5',
    icon: 'bg-red-500/10 text-red-700 dark:text-red-300',
    badge: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  info: {
    card: 'border-sky-500/20 bg-sky-500/5',
    icon: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    badge: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
}
