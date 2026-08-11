import type { TemplateManifest } from '../schema'
import type { ResumeAppearancePatch } from '@/lib/schema'
import { RESUME_FONT_FAMILIES } from '@/lib/schema'

const PAGE_PADDING_TO_MARGIN: Record<string, number> = {
  sm: 12,
  md: 16,
  lg: 24,
}

const DEFAULT_SPACING_PRESET: NonNullable<ResumeAppearancePatch['spacing']> = {
  sectionSpacing: 20,
  lineHeight: 1.6,
  pageMargin: 16,
}

const SPACING_PRESET_MAP: Record<string, NonNullable<ResumeAppearancePatch['spacing']>> = {
  default: {
    ...DEFAULT_SPACING_PRESET,
  },
  compact: {
    sectionSpacing: 14,
    lineHeight: 1.4,
    pageMargin: 12,
  },
}

const COLOR_PRESET_MAP: Record<string, ResumeAppearancePatch['theme']> = {
  default: { theme: 'default' },
  modern: { theme: 'blue' },
}

const FONT_PRESET_MAP: Record<string, ResumeAppearancePatch['font']> = {
  default: {
    fontFamily: RESUME_FONT_FAMILIES.sans,
  },
}

const DENSITY_FONT_SIZE_MAP: Record<TemplateManifest['layout']['density'], number> = {
  compact: 13,
  normal: 14,
  comfortable: 16,
}

const DENSITY_LINE_HEIGHT_MAP: Record<TemplateManifest['layout']['density'], number> = {
  compact: 1.4,
  normal: 1.6,
  comfortable: 1.8,
}

export function getAppearanceOverrideFromTemplateManifest(
  manifest: TemplateManifest,
): ResumeAppearancePatch {
  const spacingPreset = SPACING_PRESET_MAP[manifest.tokens.spacingPreset] ?? DEFAULT_SPACING_PRESET
  const pageMargin = PAGE_PADDING_TO_MARGIN[manifest.layout.page.pagePaddingToken] ?? spacingPreset.pageMargin ?? 16

  return {
    spacing: {
      ...spacingPreset,
      pageMargin,
      lineHeight: DENSITY_LINE_HEIGHT_MAP[manifest.layout.density] ?? spacingPreset.lineHeight,
    },
    font: {
      ...(FONT_PRESET_MAP[manifest.tokens.fontPreset] ?? FONT_PRESET_MAP.default),
      fontSize: DENSITY_FONT_SIZE_MAP[manifest.layout.density] ?? 14,
    },
    theme: COLOR_PRESET_MAP[manifest.tokens.colorPreset] ?? COLOR_PRESET_MAP.default,
  }
}
