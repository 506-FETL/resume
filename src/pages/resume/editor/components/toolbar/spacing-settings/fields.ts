import type { ResumeAppearanceConfig } from '@/lib/schema'

export const FINE_SPACING_FIELDS = [
  {
    key: 'sectionSpacing',
    label: '模块上下间距',
    min: 0,
    max: 100,
    decimals: 1,
    suffix: 'px',
  },
  {
    key: 'lineHeight',
    label: '行间距',
    min: 1,
    max: 3,
    decimals: 2,
    suffix: '倍',
  },
  {
    key: 'pageMargin',
    label: '页面边距',
    min: 0,
    max: 100,
    decimals: 1,
    suffix: 'px',
  },
] as const

export type Spacing = ResumeAppearanceConfig['spacing']

export type FineSpacingKey = (typeof FINE_SPACING_FIELDS)[number]['key']

export type FineSpacingField = (typeof FINE_SPACING_FIELDS)[number]

export type FineSpacingDraft = Record<FineSpacingKey, string>

export type PendingExit = 'close' | 'coarse'

export interface SpacingSettingsProps {
  isMobile: boolean
  disabled: boolean
}

export interface ValidationResult {
  value: number | null
  error: string | null
}

export function createDraft(spacing: Spacing): FineSpacingDraft {
  return {
    sectionSpacing: String(spacing.sectionSpacing),
    lineHeight: String(spacing.lineHeight),
    pageMargin: String(spacing.pageMargin),
  }
}

export function validateDraftValue(
  field: FineSpacingField,
  rawValue: string,
): ValidationResult {
  const value = rawValue.trim()

  if (!value) {
    return { value: null, error: '请输入数值' }
  }

  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    return { value: null, error: '请输入有效的十进制数字' }
  }

  const fractionDigits = value.split('.')[1]?.length ?? 0

  if (fractionDigits > field.decimals) {
    return { value: null, error: `最多保留 ${field.decimals} 位小数` }
  }

  const parsed = Number(value)

  if (parsed < field.min || parsed > field.max) {
    return { value: null, error: `请输入 ${field.min}–${field.max} 之间的数值` }
  }

  return { value: parsed, error: null }
}
