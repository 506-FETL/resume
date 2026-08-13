import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useMemo } from 'react'
import { getFontFamilyCSS, getFontFamilyName, getResumeFontWeights, normalizeResumeAppearance, themeColorMap } from '@/lib/schema'
import useResumeConfigStore from '@/store/resume/config'

/**
 * 从简历配置 store 中派生出可直接用于渲染的样式令牌。
 *
 * Hook 会读取字号、字体、间距和主题配置，并把这些原始配置转换为
 * 组件更容易消费的样式对象，例如：
 * - 字体族与不同文本层级的字号
 * - 页面与区块间距
 * - 当前主题对应的颜色映射
 *
 * 适用于简历预览、导出模板和编辑器画布等需要共享同一套样式参数的场景。
 *
 * @returns 包含 `font`、`spacing` 和 `theme` 的样式配置对象
 */
export function useResumeStyles(appearanceOverride?: Partial<ResumeAppearanceConfig> | null) {
  const storeSpacingConfig = useResumeConfigStore(state => state.spacing)
  const storeSpacingPreview = useResumeConfigStore(state => state.spacingPreview)
  const storeFontConfig = useResumeConfigStore(state => state.font)
  const storeThemeConfig = useResumeConfigStore(state => state.theme)

  const appearance = useMemo(
    () => appearanceOverride
      ? normalizeResumeAppearance(appearanceOverride)
      : {
          spacing: storeSpacingPreview ?? storeSpacingConfig,
          font: storeFontConfig,
          theme: storeThemeConfig,
        },
    [appearanceOverride, storeFontConfig, storeSpacingConfig, storeSpacingPreview, storeThemeConfig],
  )

  const { spacing: spacingConfig, font: fontConfig, theme: themeConfig } = appearance

  const resumeTheme = useMemo(() => themeColorMap[themeConfig.theme], [themeConfig.theme])

  const fontSize = fontConfig.fontSize

  const font = useMemo(() => {
    const weights = getResumeFontWeights(fontConfig.fontFamily)
    return {
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
    }
  }, [fontConfig.fontFamily, fontSize])

  const spacing = useMemo(() => ({
    pagePadding: `${spacingConfig.pageMargin}px`,
    sectionMargin: `${spacingConfig.sectionSpacing}px`,
    entrySpacing: '0.55rem',
    sectionTitleMargin: '0.75rem',
    itemSpacing: '0.55rem',
    paragraphSpacing: '0.25rem',
    lineHeight: spacingConfig.lineHeight,
    proseLineHeight: spacingConfig.lineHeight,
  }), [spacingConfig.pageMargin, spacingConfig.sectionSpacing, spacingConfig.lineHeight])

  return {
    appearance,
    font,
    spacing,
    theme: resumeTheme,
  }
}
