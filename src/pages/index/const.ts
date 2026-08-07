import type { ResumeType } from '@/lib/schema'

// 简历类型映射
export const TYPE_LABELS: Record<ResumeType, string> = {
  default: '标准',
  simple: '简约',
  modern: '现代',
}
