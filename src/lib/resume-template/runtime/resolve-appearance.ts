import type { ResumeAppearanceConfig } from '@/lib/schema'
import {
  getFontFamilyCSS,
  getFontFamilyName,
  getResumeFontWeights,
  themeColorMap,
} from '@/lib/schema'

export function resolveResumeAppearanceStyles(
  appearance: ResumeAppearanceConfig,
) {
  const {
    font: fontConfig,
    spacing: spacingConfig,
    theme: themeConfig,
  } = appearance

  const fontSize = fontConfig.fontSize
  const weights = getResumeFontWeights(fontConfig.fontFamily)

  return {
    appearance,
    font: {
      familyName: getFontFamilyName(fontConfig.fontFamily),
      fontFamily: getFontFamilyCSS(fontConfig.fontFamily),
      nameSize: `${fontSize * 1.5}px`,
      jobIntentSize: `${fontSize}px`,
      sectionTitleSize: `${fontSize}px`,
      contentSize: `${fontSize * 0.875}px`,
      smallSize: `${fontSize * 0.75}px`,
      boldWeight: weights.bold,
      mediumWeight: weights.medium,
      normalWeight: weights.normal,
    },
    spacing: {
      pagePadding: `${spacingConfig.pageMargin}px`,
      sectionMargin: `${spacingConfig.sectionSpacing}px`,
      entrySpacing: '0.55rem',
      sectionTitleMargin: '0.75rem',
      itemSpacing: '0.55rem',
      paragraphSpacing: '0.25rem',
      lineHeight: spacingConfig.lineHeight,
      proseLineHeight: spacingConfig.lineHeight,
    },
    theme: themeColorMap[themeConfig.theme],
  }
}
