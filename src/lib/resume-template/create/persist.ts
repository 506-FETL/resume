import type {
  CreatedTemplateResume,
  PreparedResumeCreation,
  ResumeCreationPersistence,
} from './types'
import { CreationOutcomeUnknownError } from './types'

/** 查询失败不等于记录不存在；重试始终使用原身份且从不覆盖已创建内容。 */
export async function persistPreparedResume(
  prepared: PreparedResumeCreation,
  persistence: ResumeCreationPersistence,
): Promise<CreatedTemplateResume> {
  const existing = await persistence.find(prepared)

  if (existing) return existing

  try {
    return await persistence.insert(prepared)
  } catch (error) {
    let created: CreatedTemplateResume | null

    try {
      created = await persistence.find(prepared)
    } catch {
      throw new CreationOutcomeUnknownError()
    }

    if (created) return created

    throw error
  }
}
