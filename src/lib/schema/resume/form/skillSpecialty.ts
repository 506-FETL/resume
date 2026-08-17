import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'

const proficiencyLevelEnum = z.enum(['一般', '良好', '熟练', '擅长', '精通'])
export type ProficiencyLevel = z.infer<typeof proficiencyLevelEnum>

const displayTypeEnum = z.enum(['text', 'percentage'])
export type DisplayType = z.infer<typeof displayTypeEnum>

export const PROFICIENCY_PERCENTAGE_MAP: Record<ProficiencyLevel, number> = {
  一般: 50,
  良好: 65,
  熟练: 80,
  擅长: 85,
  精通: 95,
}

// 预设技能标签
export const PRESET_SKILLS = [
  'Office软件',
  '沟通能力',
  '文案编辑',
  '数据分析',
  '推广运营',
  '产品设计',
  '广告设计',
  'JavaScript',
  'Java',
  'Python',
  'PHP',
  'NodeJs',
  '英语',
] as const

export type PresetSkill = (typeof PRESET_SKILLS)[number]

// 单个技能特长项
export const skillItemSchema = z.object({
  entryId: resumeEntryIdSchema,
  hidden: z.boolean().optional(),
  label: z.string().trim(),
  proficiencyLevel: proficiencyLevelEnum,
  displayType: displayTypeEnum,
})
export type SkillItem = z.infer<typeof skillItemSchema>

const skillListSchema = z.array(skillItemSchema)

export const skillSpecialtyFormSchema = z.object({
  description: z.string().trim().default(''),
  skills: skillListSchema,
})

export type SkillSpecialtyFormType = z.infer<typeof skillSpecialtyFormSchema>

export const DEFAULT_SKILL_SPECIALTY: SkillSpecialtyFormType = {
  description: '',
  skills: [],
}
