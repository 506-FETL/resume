import {
  resolveResumeTemplateBinding,
  type ResumeTemplateBinding,
} from '@/lib/schema/resume/template-binding'

/** 检查精确引用；持久化读取边界负责给无效引用补齐默认模板。 */
export function readResumeListTemplateBinding(
  value: unknown,
): ResumeTemplateBinding | null {
  try {
    return resolveResumeTemplateBinding(value)
  } catch {
    return null
  }
}
