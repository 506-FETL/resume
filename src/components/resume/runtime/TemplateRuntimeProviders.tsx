import type { PropsWithChildren } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { ResolvedTemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useMemo } from 'react'
import { ResumeContextProvider } from '@/components/resume/runtime/context/resume-context'
import { TemplateResumeDataProvider } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import { useResumeStyles } from '@/hooks/use-resume-styles'

export function TemplateRuntimeProviders({
  children,
  data,
  appearance,
  layout,
  projectionReferenceDate,
}: PropsWithChildren<{
  data: TemplateResumeData
  appearance?: Partial<ResumeAppearanceConfig> | null
  layout: ResolvedTemplateManifest['layout']
  projectionReferenceDate: string
}>) {
  const { font, spacing, theme } = useResumeStyles(appearance)
  const commentNodesByKey = useMemo(() => {
    const { document } = buildCommentAnchorDocument(data, projectionReferenceDate)
    return new Map(document.nodes.map(node => [node.nodeKey, node]))
  }, [data, projectionReferenceDate])
  const resumeContext = useMemo(() => ({
    theme,
    spacing,
    font,
    layout,
    projectionReferenceDate,
    commentNodesByKey,
  }), [
    commentNodesByKey,
    font,
    layout,
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
