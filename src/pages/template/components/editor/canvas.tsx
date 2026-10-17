import { AnimatedContent } from '@/components/motion/animated-content'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizeResumeAppearance } from '@/lib/schema'
import { useTemplatePreviewResume } from '../../hooks/use-template-preview-resume'
import { useTemplateEditorStore } from '../../store'
import { getAppearanceOverrideFromTemplateManifest } from '../../utils'
import { TemplatePreviewResumeSelect } from './preview-resume-select'

export function TemplateCanvas() {
  const { manifestDraft: manifest, previewResumeId, setPreviewResumeId } = useTemplateEditorStore()
  const { loading, previewData, resumeOptions, selectedResumeId } = useTemplatePreviewResume(previewResumeId)

  if (!manifest) {
    return null
  }

  const appearance = normalizeResumeAppearance(getAppearanceOverrideFromTemplateManifest(manifest))

  return (
    <Card className="max-h-[69vh]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <CardTitle>实时预览</CardTitle>
        <TemplatePreviewResumeSelect
          options={resumeOptions}
          value={selectedResumeId}
          onValueChange={setPreviewResumeId}
        />
      </CardHeader>
      <CardContent className="overflow-auto">
        <AnimatedContent animationKey={loading ? 'loading' : selectedResumeId ?? 'sample'}>
          {loading
            ? (
                <div className="flex items-center justify-center rounded-lg bg-background text-sm text-muted-foreground">
                  预览加载中...
                </div>
              )
            : (
                <ScaledReadonlyPreview
                  data={previewData}
                  appearance={appearance}
                  manifest={manifest}
                />
              )}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}
