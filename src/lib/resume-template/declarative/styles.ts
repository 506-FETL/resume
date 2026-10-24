import type { CSSProperties } from 'react'
import type { TemplateStyleEnvironment } from './style-values'
import type { TemplateDefinition, TemplateStyle } from './types'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import {
  getFontFamilyCSS,
  getResumeFontWeights,
  themeColorMap,
} from '@/lib/schema'
import { resolveStyleProperty } from './style-properties'

export type { TemplateStyleEnvironment } from './style-values'

export { resolveColor, resolveNumeric } from './style-values'

export function createTemplateStyleEnvironment(
  definition: TemplateDefinition,
  appearance: ResumeAppearanceConfig,
): TemplateStyleEnvironment {
  const size = appearance.font.fontSize
  const weights = getResumeFontWeights(appearance.font.fontFamily)
  const theme = themeColorMap[appearance.theme.theme]

  return {
    numbers: {
      pageMargin: appearance.spacing.pageMargin,
      fontSize: size,
      nameSize: size * 1.5,
      contentSize: size * 0.875,
      smallSize: size * 0.75,
      lineHeight: appearance.spacing.lineHeight,
      sectionSpacing: appearance.spacing.sectionSpacing,
      entrySpacing: 8.8,
      paragraphSpacing: 4,
      normalWeight: weights.normal,
      mediumWeight: weights.medium,
      boldWeight: weights.bold,
    },
    colors: {
      primary:
        appearance.theme.theme === 'default'
          ? definition.tokens.primary
          : theme.primaryColor,
      accent: definition.tokens.accent,
      text: theme.textPrimary,
      secondary: theme.textSecondary,
      muted: theme.textMuted,
      track: theme.progressBarBg,
      badge: theme.badgeBg,
    },
    fontFamily: getFontFamilyCSS(appearance.font.fontFamily),
  }
}

export function resolveTemplateStyle(
  style: TemplateStyle | undefined,
  environment: TemplateStyleEnvironment,
): CSSProperties {
  const resolved: CSSProperties = {}

  for (const property of Object.keys(style ?? {}) as (keyof TemplateStyle)[]) {
    const value = style![property]

    if (value !== undefined)
      Object.assign(
        resolved,
        resolveStyleProperty(property, value, environment),
      )
  }

  if (
    Object.keys(resolved).some(
      (property) => property.startsWith('border') && property.endsWith('Width'),
    )
  )
    resolved.borderStyle ??= 'solid'

  return resolved
}

export function resolveLayoutStyle(
  layout: 'stack' | 'row' | 'wrap' | 'grid',
): CSSProperties {
  return layout === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }
    : {
        display: 'flex',
        flexDirection: layout === 'stack' ? 'column' : 'row',
        flexWrap: layout === 'wrap' ? 'wrap' : 'nowrap',
      }
}
