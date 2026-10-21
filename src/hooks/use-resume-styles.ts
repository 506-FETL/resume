import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useMemo } from 'react'
import { normalizeResumeAppearance } from '@/lib/schema'
import { resolveResumeAppearanceStyles } from '@/lib/resume-template/runtime/resolve-appearance'
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
  const storeFontConfig = useResumeConfigStore(state => state.font)
  const storeThemeConfig = useResumeConfigStore(state => state.theme)

  const appearance = useMemo(
    () => appearanceOverride
      ? normalizeResumeAppearance(appearanceOverride)
      : {
          spacing: storeSpacingConfig,
          font: storeFontConfig,
          theme: storeThemeConfig,
        },
    [appearanceOverride, storeFontConfig, storeSpacingConfig, storeThemeConfig],
  )

  return useMemo(() => resolveResumeAppearanceStyles(appearance), [appearance])
}
