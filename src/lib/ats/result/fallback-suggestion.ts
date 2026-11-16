import type { Suggestion } from '../../schema/ats.ts'
import type { AtsAssessmentField } from '../types.ts'
import { isRecord, readString } from './values.ts'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildFallbackSuggestion(
  field: AtsAssessmentField,
  fixSummary: string,
  steps: string[],
): Suggestion {
  const instruction = readString(
    steps[0],
    readString(fixSummary, `完善${field.locate.fieldLabel}`),
  )
    .replace(/[。；;]+$/g, '')
    .slice(0, 48)

  const placeholder = `（待补充：${instruction}）`
  const { rawValue } = field
  const normalizedPath = field.locate.path.toLowerCase()

  if (Array.isArray(rawValue) && /(?:^|\.)skills$/.test(normalizedPath)) {
    return {
      kind: 'replace_value',
      valueType: 'skill_list',
      locate: field.locate,
      before: rawValue,
      after:
        rawValue.length > 0
          ? rawValue
          : [
              {
                entryId: 'ats_pending_skill',
                label: placeholder,
                proficiencyLevel: '一般',
                displayType: 'text',
              },
            ],
      reason: '请先补充并确认真实技能信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (
    Array.isArray(rawValue) &&
    /(?:^|\.)(?:certificates|hobbies)$/.test(normalizedPath)
  ) {
    return {
      kind: 'replace_value',
      valueType: normalizedPath.endsWith('.certificates')
        ? 'certificate_list'
        : 'object_array',
      locate: field.locate,
      before: rawValue,
      after:
        rawValue.length > 0
          ? rawValue
          : [
              {
                entryId: `ats_pending_${normalizedPath.endsWith('.certificates') ? 'certificate' : 'hobby'}`,
                name: placeholder,
              },
            ],
      reason: '请先补充并确认真实信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (
    Array.isArray(rawValue) &&
    rawValue.every((item) => typeof item === 'string')
  ) {
    const isDateRange = /duration|dateRange|时间|日期/i.test(
      `${field.locate.path} ${field.locate.fieldLabel}`,
    )

    return {
      kind: isDateRange ? 'normalize_date' : 'replace_value',
      valueType: 'string_array',
      locate: field.locate,
      before: rawValue,
      after: isDateRange
        ? ['（待补充：开始时间）', '（待补充：结束时间）']
        : [placeholder],
      reason: '请先补充并确认真实信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (Array.isArray(rawValue) && rawValue.every((item) => isRecord(item))) {
    return {
      kind: 'replace_value',
      valueType: 'object_array',
      locate: field.locate,
      before: rawValue,
      after: [{ content: placeholder }],
      reason: '请先补充并确认真实信息，再应用这条修复建议。',
      fixed: false,
      requiresUserInput: true,
    }
  }

  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return {
      kind: 'replace_value',
      valueType: typeof rawValue === 'number' ? 'number' : 'boolean',
      locate: field.locate,
      before: rawValue,
      after: rawValue,
      reason: `请先填写并确认真实的${field.locate.fieldLabel}，再应用这条修复建议。`,
      fixed: false,
      requiresUserInput: true,
    }
  }

  const isHtmlField =
    typeof rawValue === 'string' &&
    (/<[a-z][\s\S]*>/i.test(rawValue) ||
      /(?:info|description|\.content)$/i.test(field.locate.path))

  return {
    kind: isHtmlField
      ? 'replace_text'
      : rawValue
        ? 'replace_value'
        : 'fill_field',
    valueType: isHtmlField ? 'html_string' : 'string',
    locate: field.locate,
    before: rawValue,
    after: isHtmlField ? `<p>${escapeHtml(placeholder)}</p>` : placeholder,
    reason: '请先补充并确认真实信息，再应用这条修复建议。',
    fixed: false,
    requiresUserInput: true,
  }
}
