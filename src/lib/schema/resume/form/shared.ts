import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'

export const durationField = z.array(z.string().trim()).length(2)

// 条目级显隐：true = 隐藏（与板块级 visibility 语义一致）。
// 用纯 optional（不加 default），使输出类型为 hidden?: boolean，
// 避免现存手动构造 item 的调用点（fixture / 表单 append 等）被迫补字段。
// 判断处统一用 !item.hidden，undefined 与 false 行为一致（默认显示）。
export const hiddenField = z.boolean().optional()

export function createExperienceSchema<T extends z.ZodRawShape>(fields: T) {
  return z.object({
    items: z.array(z.object({
      entryId: resumeEntryIdSchema,
      hidden: hiddenField,
      ...fields,
    })),
  })
}
