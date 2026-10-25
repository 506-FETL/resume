import type { TemplateSource } from '../source/types'
import type {
  CreatedTemplateResume,
  CreateTemplateResumeInput,
  CreationIdentity,
  PreparedResumeCreation,
} from './types'
import { isCloudResumeId } from '@/lib/resume-id'
import { DEFAULT_ORDER, DEFAULT_VISIBILITY, resumeSchema } from '@/lib/schema'
import { cloneResumeWithFreshEntryIds } from '@/lib/schema/resume/entry-id'
import { toTemplateBinding } from '../binding'
import { TemplateResolutionError } from '../definition-schema'
import { resolveTemplate } from '../runtime/resolve-template'

export async function prepareTemplateResume(
  input: CreateTemplateResumeInput,
  source: TemplateSource,
  identity: CreationIdentity,
): Promise<PreparedResumeCreation> {
  if (!isCloudResumeId(identity.operationId))
    throw new Error('创建操作标识无效')
  if (input.mode === 'cloud' && !identity.ownerId)
    throw new Error('请先登录后创建云端简历')

  const [definition, example] = await Promise.all([
    resolveTemplate(source, toTemplateBinding(input.template)),
    input.content ? Promise.resolve(null) : source.getExample(input.example),
  ])

  if (
    example &&
    (example.exampleId !== input.example.exampleId ||
      example.version !== input.example.version)
  )
    throw new TemplateResolutionError(
      'REFERENCE_MISMATCH',
      '示例版本与请求不一致',
    )

  let entryIndex = 0

  // 同一操作刷新后也必须保留条目身份，否则示例检查记录无法对应已保存正文。
  return {
    ...identity,
    resumeId:
      input.mode === 'local'
        ? `local-${identity.operationId}`
        : identity.operationId,
    mode: input.mode,
    displayName: input.displayName.trim() || '我的简历',
    description: input.description.trim(),
    snapshot: {
      ...cloneResumeWithFreshEntryIds(
        resumeSchema.parse(input.content ?? example?.content),
        () => `${identity.operationId}:${entryIndex++}`,
      ),
      order: structuredClone(
        input.content?.order ?? example?.content.order ?? DEFAULT_ORDER,
      ),
      visibility: structuredClone(
        input.content?.visibility ??
          example?.content.visibility ??
          DEFAULT_VISIBILITY,
      ),
      type: 'default',
      templateBinding: toTemplateBinding(input.template),
      ...structuredClone(definition.appearanceDefaults),
    },
  }
}

export function createdResumeResult(
  prepared: PreparedResumeCreation,
  record: {
    resume_id: string
    display_name?: string | null
    description?: string | null
    created_at: string
    updated_at?: string | null
  },
): CreatedTemplateResume {
  return {
    resumeId: record.resume_id,
    mode: prepared.mode,
    displayName: record.display_name ?? prepared.displayName,
    description: record.description ?? '',
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? record.created_at,
    type: 'default',
    templateBinding: prepared.snapshot.templateBinding,
  }
}
