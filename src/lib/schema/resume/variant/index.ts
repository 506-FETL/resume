import type { ResumeSchema } from '../form'

import { z } from 'zod'

export * from './types'

const RESUME_SECTION_KEYS = [
  'basics',
  'job_intent',
  'application_info',
  'edu_background',
  'work_experience',
  'internship_experience',
  'campus_experience',
  'project_experience',
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
] as const

// 编译期断言：RESUME_SECTION_KEYS 必须与 keyof ResumeSchema 完全一致，
// 防止 ResumeSchema 新增字段时出现 type 允许 / runtime 拒绝的隐性分歧。
type _SectionKeysCoverAll = Exclude<keyof ResumeSchema, (typeof RESUME_SECTION_KEYS)[number]> extends never ? true : false
type _SectionKeysNoExtra = Exclude<(typeof RESUME_SECTION_KEYS)[number], keyof ResumeSchema> extends never ? true : false
const _coversAll: _SectionKeysCoverAll = true
const _noExtra: _SectionKeysNoExtra = true
// eslint-disable-next-line no-void
void _coversAll
// eslint-disable-next-line no-void
void _noExtra

export const variantChangeSchema = z.object({
  section: z.enum(RESUME_SECTION_KEYS),
  itemId: z.string().min(1),
  fieldPath: z.string().min(1),
  before: z.string(),
  after: z.string(),
  matchedKeywords: z.array(z.string()).min(1),
  reason: z.string().max(120),
})

// changes 长度边界（3~15）随 LLM 输出协议在此 schema 闸门校验；
// 跨字段约束（after.length ≤ before.length × 1.5、after !== before）由 Task 10 parse-variant-response 在运行时校验。
export const variantMetadataSchema = z.object({
  keywords: z.array(z.string()).max(30),
  changes: z.array(variantChangeSchema).min(3).max(15),
  generatedAt: z.string().datetime(),
  matchRate: z.number().min(0).max(1),
})

export const derivedStatusSchema = z.enum(['generating', 'ready', 'failed'])
