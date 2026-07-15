import type { FormDataMap } from '@/store/resume/const'

/**
 * 9 个富文本字段的登记表：section + 相对路径 + 从表单数据读取 HTML 列表的方式。
 *
 * section 级字段返回单个 HTML（relativePath 固定）；
 * 数组项字段对每个 item 返回 `items.<index>.<field>` 的 HTML。
 */
export interface RichFieldEntry {
  sectionKey: keyof FormDataMap
  /** 列出该 section 下所有富文本字段实例（section 级 1 个；数组级每项 1 个）。 */
  list: (data: FormDataMap) => Array<{ relativePath: string, html: string }>
}

function sectionLevel(sectionKey: keyof FormDataMap, field: string): RichFieldEntry {
  return {
    sectionKey,
    list: (data) => {
      const section = data[sectionKey] as Record<string, unknown> | undefined
      const html = (section?.[field] as string | undefined) ?? ''
      return [{ relativePath: field, html }]
    },
  }
}

function arrayLevel(sectionKey: keyof FormDataMap, itemKey: string, field: string): RichFieldEntry {
  return {
    sectionKey,
    list: (data) => {
      const section = data[sectionKey] as Record<string, unknown> | undefined
      const items = (section?.[itemKey] as Array<Record<string, unknown>> | undefined) ?? []
      return items.map((item, index) => ({
        relativePath: `${itemKey}.${index}.${field}`,
        html: (item?.[field] as string | undefined) ?? '',
      }))
    },
  }
}

export const RICH_FIELDS: RichFieldEntry[] = [
  sectionLevel('self_evaluation', 'content'),
  sectionLevel('hobbies', 'description'),
  sectionLevel('honors_certificates', 'description'),
  sectionLevel('skill_specialty', 'description'),
  arrayLevel('work_experience', 'items', 'workInfo'),
  arrayLevel('internship_experience', 'items', 'internshipInfo'),
  arrayLevel('project_experience', 'items', 'projectInfo'),
  arrayLevel('edu_background', 'items', 'eduInfo'),
  arrayLevel('campus_experience', 'items', 'campusInfo'),
]
