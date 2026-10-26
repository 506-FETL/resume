import type { PropsWithChildren } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useMemo } from 'react'
import { ResumeContextProvider } from '@/components/resume/runtime/context/resume-context'
import { TemplateResumeDataProvider } from '@/components/resume/runtime/context/resume-data-context'
import { getTemplateProjection } from './template-projection'
import { resolveResumeAppearanceStyles } from '@/lib/resume-template/runtime/resolve-appearance'
import { normalizeResumeAppearance } from '@/lib/schema'

export function TemplateRuntimeProviders({
  children,
  data,
  appearance,
  projectionReferenceDate,
  tokens,
}: PropsWithChildren<{
  data: TemplateResumeData
  appearance: Partial<ResumeAppearanceConfig>
  projectionReferenceDate: string
  tokens?: TemplateDefinition['tokens']
}>) {
  const { font, spacing, theme } = useMemo(() => {
    const normalized = normalizeResumeAppearance(appearance)
    const styles = resolveResumeAppearanceStyles(normalized)

    if (!tokens) return styles

    const primaryColor =
      normalized.theme.theme === 'default'
        ? tokens.primary
        : styles.theme.primaryColor

    return {
      ...styles,
      theme: {
        ...styles.theme,
        primaryColor,
        progressBarFill: primaryColor,
        accentColor: tokens.accent,
      },
    }
  }, [appearance, tokens])

  const commentNodesByKey = useMemo(
    () => getTemplateProjection(data, projectionReferenceDate).nodes,
    [data, projectionReferenceDate],
  )

  const resumeContext = useMemo(
    () => ({
      theme,
      spacing,
      font,
      projectionReferenceDate,
      commentNodesByKey,
    }),
    [commentNodesByKey, font, projectionReferenceDate, spacing, theme],
  )

  return (
    <TemplateResumeDataProvider value={data}>
      <ResumeContextProvider value={resumeContext}>
        <div
          data-resume-runtime-root
          data-resume-runtime-ready='true'
          style={{
            fontFamily: font.fontFamily,
            fontSynthesis: 'none',
            fontSize: font.contentSize,
            fontWeight: font.normalWeight,
            lineHeight: spacing.lineHeight,
            color: theme.textPrimary,
            overflowWrap: 'anywhere',
            boxSizing: 'border-box',
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
          }}
        >
          {children}
        </div>
      </ResumeContextProvider>
    </TemplateResumeDataProvider>
  )
}
