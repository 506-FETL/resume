import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        <div className="flex flex-col gap-1">
          <CardTitle>实时预览</CardTitle>
          <CardDescription>中间画布直接复用简历预览组件与模板运行时。</CardDescription>
        </div>
        <TemplatePreviewResumeSelect
          options={resumeOptions}
          value={selectedResumeId}
          onValueChange={setPreviewResumeId}
        />
      </CardHeader>
      <CardContent className="overflow-auto">
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
      </CardContent>
    </Card>
  )
}
