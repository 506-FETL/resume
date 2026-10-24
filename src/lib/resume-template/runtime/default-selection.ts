import type { TemplateSource } from '../source/types'
import { readResumeListTemplateBinding, toTemplateBinding } from '../binding'
import { TemplateResolutionError } from '../definition-schema'
import { resumeTemplateSource } from '../source'
import { resolveTemplate } from './resolve-template'

/** 无有效引用的简历只在持久化读取边界补默认值，已绑定版本绝不自动替换。 */
export async function resolveDefaultTemplateBinding(
  binding: unknown,
  source: TemplateSource = resumeTemplateSource,
) {
  const existing = readResumeListTemplateBinding(binding)

  if (existing) return existing

  const resolved = toTemplateBinding(
    (await getDefaultTemplateSelection(source)).template,
  )

  await resolveTemplate(source, resolved)

  return resolved
}

/** 默认入口也使用已发布目录中的精确版本，禁止本地写死定义。 */
export async function getDefaultTemplateSelection(
  source: TemplateSource = resumeTemplateSource,
) {
  let offset: number | null = 0

  do {
    const page = await source.listTemplatePage({ offset })
    const item = page.items.find((item) => item.templateId === 'default')

    if (item)
      return {
        template: {
          templateId: item.templateId,
          templateVersion: item.currentVersion,
        },
        example: item.defaultExample,
      }

    offset = page.nextOffset
  } while (offset !== null)

  throw new TemplateResolutionError(
    'VERSION_NOT_FOUND',
    '默认模板尚未发布，请稍后重试',
  )
}
