import type { TemplateManifest } from '@/lib/resume-template/schema'
import ScaledResumeDocument from '@/components/resume/pagination/scaled-resume-document'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { normalizeResumeAppearance } from '@/lib/schema'
import { demoResumeData } from '@/lib/template/fixtures/demo-resume'
import { getAppearanceOverrideFromTemplateManifest } from '../../utils'

const thumbnailPreviewData = buildTemplateResumeData(demoResumeData)

interface TemplateThumbnailProps {
  manifest: TemplateManifest
}

export function TemplateThumbnail({ manifest }: TemplateThumbnailProps) {
  const appearance = normalizeResumeAppearance(getAppearanceOverrideFromTemplateManifest(manifest))

  return (
    <div className="relative aspect-210/297 overflow-hidden">
      <ScaledResumeDocument
        appearance={appearance}
        contentVersion={JSON.stringify([thumbnailPreviewData, manifest])}
        className="pointer-events-none"
      >
        <ResumeTemplateRuntime
          data={thumbnailPreviewData}
          manifest={manifest}
          appearance={appearance}
        />
      </ScaledResumeDocument>
    </div>
  )
}
