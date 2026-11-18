export interface ResumeTemplateBinding {
  source: 'official'
  templateId: string
  templateVersion: number
}

/** 精确引用是新简历的必填字段，不从简历类型推导模板。 */
export function resolveResumeTemplateBinding(
  binding: unknown,
): ResumeTemplateBinding {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding))
    throw new Error('简历缺少有效模板引用，请从模板库新建简历')

  const value = binding as Record<string, unknown>

  if (
    value.source !== 'official' ||
    typeof value.templateId !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.templateId) ||
    value.templateId.length > 80 ||
    !Number.isSafeInteger(value.templateVersion) ||
    Number(value.templateVersion) <= 0 ||
    Object.keys(value).some(
      (key) => !['source', 'templateId', 'templateVersion'].includes(key),
    )
  ) {
    throw new Error('简历模板引用无效，请从模板库新建简历')
  }

  return {
    source: 'official',
    templateId: value.templateId,
    templateVersion: Number(value.templateVersion),
  }
}
