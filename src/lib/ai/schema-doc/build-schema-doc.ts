import { z } from 'zod'
import { resumeSchema } from '../../schema/resume/form/index.ts'

const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '应聘信息',
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

type AnyZod = z.ZodTypeAny

/**
 * 解开 ZodOptional / ZodDefault / ZodNullable 包装层，返回内部核心类型。
 * Zod 4 中这三个包装类均通过 _def.innerType 指向内层 schema。
 */
function unwrap(schema: AnyZod): AnyZod {
  let cur: any = schema
  while (
    cur instanceof z.ZodOptional
    || cur instanceof z.ZodDefault
    || cur instanceof z.ZodNullable
  ) {
    cur = cur._def.innerType
  }
  return cur as AnyZod
}

/**
 * 从 ZodArray 的 _def.checks 中读取 length_equals 约束值。
 * Zod 4 的 check 对象将元数据存储在非枚举属性 _zod.def 中。
 */

function getArrayExactLength(schema: any): number | undefined {
  const checks: any[] = schema._def.checks ?? []
  for (const check of checks) {
    const def = check._zod?.def
    if (def?.check === 'length_equals') {
      return def.length as number
    }
  }
  return undefined
}

/**
 * 生成单个字段的紧凑类型描述字符串。
 * 重点标注：对象数组、长度固定为 2 的字符串数组、枚举取值。
 */
function describeField(schema: AnyZod): string {
  const t = unwrap(schema)

  if (t instanceof z.ZodString) {
    return 'string'
  }
  if (t instanceof z.ZodNumber) {
    return 'number'
  }
  if (t instanceof z.ZodBoolean) {
    return 'boolean'
  }

  if (t instanceof z.ZodEnum) {
    // Zod 4 公开 API：t.options 返回枚举值数组

    const values = (t as any).options as string[]
    return `enum(${values.map(v => `"${v}"`).join(' | ')})`
  }

  if (t instanceof z.ZodArray) {
    // Zod 4：元素类型在 _def.element

    const element = unwrap((t as any)._def.element as AnyZod)
    const exactLen = getArrayExactLength(t)

    if (element instanceof z.ZodString) {
      return exactLen === 2
        ? 'string[]（长度固定为 2：[开始, 结束]）'
        : 'string[]'
    }

    if (element instanceof z.ZodObject) {
      return `【对象数组】，元素字段：{ ${describeObjectShape(element)} }`
    }

    return 'array'
  }

  if (t instanceof z.ZodObject) {
    return `object：{ ${describeObjectShape(t)} }`
  }

  return 'any'
}

/**
 * 将 ZodObject 的 shape 展开为 "key: type" 序列。
 * 过滤 entryId（系统生成）和 hidden（内部 UI 状态）。
 */

function describeObjectShape(objSchema: z.ZodObject<any>): string {
  const shape = objSchema.shape as Record<string, AnyZod>
  return Object.entries(shape)
    .filter(([key]) => key !== 'entryId' && key !== 'hidden')
    .map(([key, field]) => `${key}: ${describeField(field)}`)
    .join('; ')
}

/**
 * 遍历 resumeSchema 生成紧凑的模块字段结构说明文本。
 * 供注入 AI 上下文，让模型在调用 update_current_resume_field 前
 * 就知道每个模块的正确字段结构，避免盲写错误。
 */
export function buildResumeSchemaDoc(): string {
  const shape = resumeSchema.shape
  const lines: string[] = [
    '【简历模块字段结构（写入 update_current_resume_field 的 value 必须严格匹配）】',
    '重要约束：',
    '- 列表型字段（skills / certificates / hobbies / 各经历的 items / customFields）是【对象数组】，不是字符串数组，每个元素是带指定字段的对象。',
    '- 各时间字段（workDuration / internshipDuration / duration / projectDuration）是【长度固定为 2 的字符串数组】：[开始时间, 结束时间]。',
    '- enum 字段只能取列出的值之一。entryId 由系统自动生成，无需提供。',
    '',
  ]

  for (const [key, sectionSchema] of Object.entries(shape)) {
    const label = SECTION_LABELS[key] ?? key
    lines.push(`- ${key}（${label}）：${describeField(sectionSchema as AnyZod)}`)
  }

  return lines.join('\n')
}
