import type { PropsWithChildren } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
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
}: PropsWithChildren<{
  data: TemplateResumeData
  appearance: Partial<ResumeAppearanceConfig>
  projectionReferenceDate: string
}>) {
  const { font, spacing, theme } = useMemo(() => resolveResumeAppearanceStyles(normalizeResumeAppearance(appearance)), [appearance])
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
