import type { VariantStepConfig } from './types'
import type { ResumeSchema } from '@/lib/schema'
import { Brain, CheckCircle2, Copy, ScanText, ShieldCheck, Wand2 } from 'lucide-react'

export const MIN_JD_CHARS = 30
export const MIN_KEYWORDS = 3
export const MAX_KEYWORDS = 30
export const MIN_CHANGES = 3
export const MAX_CHANGES = 15
export const MAX_VARIANT_DEPTH = 5
export const REWRITE_AFTER_LENGTH_RATIO = 1.5

/** 可改写字段白名单（与 spec §1.5 完全一致） */
export const FIELD_WHITELIST: Array<{ section: keyof ResumeSchema, fieldPath: string }> = [
  { section: 'basics', fieldPath: 'summary' },
  { section: 'job_intent', fieldPath: 'content' },
  { section: 'skill_specialty', fieldPath: 'content' },
  { section: 'self_evaluation', fieldPath: 'content' },
  { section: 'work_experience', fieldPath: 'description' },
  { section: 'work_experience', fieldPath: 'bullets' },
  { section: 'internship_experience', fieldPath: 'description' },
  { section: 'internship_experience', fieldPath: 'bullets' },
  { section: 'project_experience', fieldPath: 'description' },
  { section: 'project_experience', fieldPath: 'techStack' },
  { section: 'campus_experience', fieldPath: 'description' },
]

export const JD_VARIANT_STEPS: VariantStepConfig[] = [
  { id: 'parsing', label: '解析 JD 关键词', icon: ScanText },
  { id: 'thinking', label: '模型正在思考', icon: Brain },
  { id: 'cloning', label: '复制源简历草稿', icon: Copy },
  { id: 'rewriting', label: '改写候选字段', icon: Wand2 },
  { id: 'validating', label: '校验输出与匹配率', icon: ShieldCheck },
  { id: 'done', label: '完成', icon: CheckCircle2 },
]

export const MESSAGES = {
  dialogTitle: (name: string) => `为「${name}」派生 JD 变体`,
  dialogSubtitle: '在原简历基础上，AI 会针对 JD 局部改写文案，事实型字段保持不变。',
  jdPlaceholder: '粘贴目标岗位的 JD 文本（≥ 30 字）。',
  jdMinHint: (curr: number) => `${curr} / 至少 ${MIN_JD_CHARS} 字`,
  parsing: '正在解析 JD 关键词…',
  cloning: '正在复制源简历草稿…',
  rewriting: '改写中…',
  validating: '校验输出与匹配率…',
  done: '变体生成完成',
  errorTitle: '派生失败',
  cancelConfirmTitle: '派生中，确认放弃？',
  cancelConfirmDesc: (n: number) => `已生成 ${n} 处改写。放弃将删除草稿简历。`,
  matchRateLow: '当前匹配度较低，可考虑「再生成一次」或微调 JD 后重试。',
  emptyChanges: 'AI 改写无效，请重试',
  variantBadge: 'JD 变体',
  variantsCount: (n: number) => `${n} 个变体`,
  derivingFrom: (name: string) => `派生自《${name}》`,
  filterAll: '全部',
  filterOriginals: '原始简历',
  filterVariants: 'JD 变体',
  derivedJobsBanner: (n: number, m: number) => `派生中 (${n}) / 失败的派生 (${m})`,
} as const
