import type { PropsWithChildren } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { ResolvedTemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { ResumeContextProvider } from '@/components/resume/runtime/context/resume-context'
import { TemplateResumeDataProvider } from '@/components/resume/runtime/context/resume-data-context'
import { useResumeStyles } from '@/hooks/use-resume-styles'

export function TemplateRuntimeProviders({
  children,
  data,
  appearance,
  layout,
}: PropsWithChildren<{
  data: TemplateResumeData
  appearance?: Partial<ResumeAppearanceConfig> | null
  layout: ResolvedTemplateManifest['layout']
}>) {
  const { font, spacing, theme } = useResumeStyles(appearance)

  return (
    <TemplateResumeDataProvider value={data}>
      <ResumeContextProvider value={{ theme, spacing, font, layout }}>
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
