import { buildResumeSchemaDoc } from './build-schema-doc.ts'

let cached: string | null = null

/**
 * 返回从 resumeSchema 自动派生的简历结构说明文本。
 * schema 在进程内是静态的，第一次调用时构建，后续命中缓存。
 */
export function getResumeSchemaDoc(): string {
  if (cached == null)
    cached = buildResumeSchemaDoc()
  return cached
}
