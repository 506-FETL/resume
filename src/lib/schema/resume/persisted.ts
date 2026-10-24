import type { FontConfigType } from './config/font'
import type { SpacingConfigType } from './config/spacing'
import type { ThemeConfigType } from './config/theme'
import type { ORDERType, ResumeSchema, ResumeType } from './index'
import type { VisibilityFormType } from './visibility'
import {
  DEFAULT_FONT_CONFIG,
  fontConfigSchema,
  normalizeResumeFontFamily,
} from './config/font'
import { DEFAULT_SPACING_CONFIG, spacingConfigSchema } from './config/spacing'
import { DEFAULT_THEME_CONFIG, themeConfigSchema } from './config/theme'

export interface ResumeAppearanceConfig {
  spacing: SpacingConfigType
  font: FontConfigType
  theme: ThemeConfigType
}

export interface ResumeAppearancePatch {
  spacing?: Partial<SpacingConfigType>
  font?: Partial<FontConfigType>
  theme?: Partial<ThemeConfigType>
}

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

export const DEFAULT_RESUME_APPEARANCE: ResumeAppearanceConfig = {
  spacing: DEFAULT_SPACING_CONFIG,
  font: DEFAULT_FONT_CONFIG,
  theme: DEFAULT_THEME_CONFIG,
}

export function normalizeSpacingConfig(value: unknown): SpacingConfigType {
  const parsed = spacingConfigSchema.safeParse(value)

  return parsed.success ? parsed.data : DEFAULT_SPACING_CONFIG
}

export function normalizeFontConfig(value: unknown): FontConfigType {
  const input =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  const parsed = fontConfigSchema.safeParse({
    ...DEFAULT_FONT_CONFIG,
    ...input,
    fontFamily: normalizeResumeFontFamily(input.fontFamily),
  })

  return parsed.success ? parsed.data : DEFAULT_FONT_CONFIG
}

export function normalizeThemeConfig(value: unknown): ThemeConfigType {
  const parsed = themeConfigSchema.safeParse(value)

  return parsed.success ? parsed.data : DEFAULT_THEME_CONFIG
}

export function normalizeResumeAppearance(
  value: ResumeAppearancePatch | null | undefined,
): ResumeAppearanceConfig {
  return {
    spacing: normalizeSpacingConfig({
      ...DEFAULT_SPACING_CONFIG,
      ...(value?.spacing ?? {}),
    }),
    font: normalizeFontConfig({
      ...DEFAULT_FONT_CONFIG,
      ...(value?.font ?? {}),
    }),
    theme: normalizeThemeConfig({
      ...DEFAULT_THEME_CONFIG,
      ...(value?.theme ?? {}),
    }),
  }
}

export function mergeResumeAppearance(
  base: ResumeAppearanceConfig,
  patch: ResumeAppearancePatch | null | undefined,
): ResumeAppearanceConfig {
  return normalizeResumeAppearance({
    spacing: { ...base.spacing, ...(patch?.spacing ?? {}) },
    font: { ...base.font, ...(patch?.font ?? {}) },
    theme: { ...base.theme, ...(patch?.theme ?? {}) },
  })
}

export interface PersistedResumeSnapshot
  extends ResumeSchema, ResumeAppearanceConfig {
  order: ORDERType[]
  visibility: VisibilityFormType
  type: ResumeType
  templateBinding: ResumeTemplateBinding
}
