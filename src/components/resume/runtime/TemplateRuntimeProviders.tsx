import type { PropsWithChildren } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useMemo } from 'react'
import { ResumeContextProvider } from '@/components/resume/runtime/context/resume-context'
import { TemplateResumeDataProvider } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import { resolveResumeAppearanceStyles } from '@/lib/resume-template/runtime/resolve-appearance'
import { normalizeResumeAppearance } from '@/lib/schema'

export function TemplateRuntimeProviders({
  children,
  data,
  appearance,
  projectionReferenceDate,
  palette,
}: PropsWithChildren<{
  data: TemplateResumeData
  appearance: Partial<ResumeAppearanceConfig>
  projectionReferenceDate: string
  palette?: TemplateDefinition['palette']
}>) {
  const { font, spacing, theme } = useMemo(() => {
    const normalized = normalizeResumeAppearance(appearance)
    const styles = resolveResumeAppearanceStyles(normalized)
    if (!palette)
      return styles
    const primaryColor = normalized.theme.theme === 'default' ? palette.primary : styles.theme.primaryColor
    return { ...styles, theme: { ...styles.theme, primaryColor, progressBarFill: primaryColor, accentColor: palette.accent } }
  }, [appearance, palette])
  const commentNodesByKey = useMemo(() => {
    const { document } = buildCommentAnchorDocument(data, projectionReferenceDate)
    return new Map(document.nodes.map(node => [node.nodeKey, node]))
  }, [data, projectionReferenceDate])
  const resumeContext = useMemo(() => ({
    theme,
    spacing,
    font,
    projectionReferenceDate,
    commentNodesByKey,
  }), [
    commentNodesByKey,
    font,
    projectionReferenceDate,
    spacing,
    theme,
  ])

  return (
    <TemplateResumeDataProvider value={data}>
      <ResumeContextProvider value={resumeContext}>
        <div
          data-resume-runtime-root
          style={{
            fontFamily: font.fontFamily,
            fontSynthesis: 'none',
          }}
        >
          {children}
        </div>
      </ResumeContextProvider>
    </TemplateResumeDataProvider>
  )
}
