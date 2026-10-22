import type { CSSProperties } from 'react'
import type { ColorToken, ColorValue, NumericToken, StyleValue, TemplateDefinition, TemplateStyle } from './types'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { getFontFamilyCSS, getResumeFontWeights, themeColorMap } from '@/lib/schema'

export interface TemplateStyleEnvironment {
  numbers: Record<NumericToken, number>
  colors: Record<ColorToken, string>
  fontFamily: string
}
export function createTemplateStyleEnvironment(definition: TemplateDefinition, appearance: ResumeAppearanceConfig): TemplateStyleEnvironment {
  const size = appearance.font.fontSize
  const weights = getResumeFontWeights(appearance.font.fontFamily)
  const theme = themeColorMap[appearance.theme.theme]
  return {
    numbers: { fontSize: size, nameSize: size * 1.5, contentSize: size * 0.875, smallSize: size * 0.75, lineHeight: appearance.spacing.lineHeight, sectionSpacing: appearance.spacing.sectionSpacing, entrySpacing: 8.8, paragraphSpacing: 4, normalWeight: weights.normal, mediumWeight: weights.medium, boldWeight: weights.bold },
    colors: { primary: appearance.theme.theme === 'default' ? definition.tokens.primary : theme.primaryColor, accent: definition.tokens.accent, text: theme.textPrimary, secondary: theme.textSecondary, muted: theme.textMuted, track: theme.progressBarBg, badge: theme.badgeBg },
    fontFamily: getFontFamilyCSS(appearance.font.fontFamily),
  }
}
export function resolveNumeric(value: StyleValue, environment: TemplateStyleEnvironment): number {
  return typeof value === 'number' ? value : environment.numbers[value.token] * (value.factor ?? 1) + (value.add ?? 0)
}
export function resolveColor(value: ColorValue, environment: TemplateStyleEnvironment): string {
  return typeof value === 'string' ? value : environment.colors[value.token]
}
const unitless = new Set(['fontWeight', 'lineHeight', 'flexGrow', 'flexShrink'])
export function resolveTemplateStyle(style: TemplateStyle | undefined, environment: TemplateStyleEnvironment): CSSProperties {
  const resolved: Record<string, string | number> = {}
  Object.entries(style ?? {}).forEach(([property, value]) => {
    if (value === undefined)
      return
    if (property === 'columns') {
      resolved.gridTemplateColumns = (value as number[]).map(column => `minmax(0, ${column}fr)`).join(' ')
    }
    else if (['color', 'backgroundColor', 'borderColor'].includes(property)) {
      resolved[property] = resolveColor(value as ColorValue, environment)
    }
    else if (['textAlign', 'alignItems', 'justifyContent', 'whiteSpace'].includes(property)) {
      resolved[property] = value as string
    }
    else {
      const number = resolveNumeric(value as StyleValue, environment)
      // margins 允许折角标题的局部偏移；其他尺寸不能产生负几何。
      const bounded = Math.max(property.startsWith('margin') ? -256 : 0, Math.min(number, 4096))
      resolved[property] = unitless.has(property) ? bounded : `${bounded}px`
    }
  })
  if (Object.keys(resolved).some(property => property.startsWith('border') && property.endsWith('Width')))
    resolved.borderStyle = 'solid'
  return resolved as CSSProperties
}
export function resolveLayoutStyle(layout: 'stack' | 'row' | 'wrap' | 'grid'): CSSProperties {
  return layout === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }
    : { display: 'flex', flexDirection: layout === 'stack' ? 'column' : 'row', flexWrap: layout === 'wrap' ? 'wrap' : 'nowrap' }
}
