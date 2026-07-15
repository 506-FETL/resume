import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTemplateEditorStore } from '../../store'
import { TemplateAppearanceSettings } from './appearance-settings'
import { TemplateSectionSettings } from './section-settings'

export function TemplatePropertiesPanel() {
  const { manifestDraft: manifest, selectedSectionId, setSelectedSection, applyManifest } = useTemplateEditorStore()

  if (!manifest) {
    return null
  }

  const selectedSection = manifest.sections.find(section => section.sectionId === selectedSectionId) ?? null

  return (
    <Card className="max-h-[69vh] overflow-auto">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{selectedSection ? '模块属性' : '模板属性'}</CardTitle>
            <CardDescription>
              {selectedSection ? '调整当前模块的结构与展示方式。' : '调整模板整体的布局与视觉配置。'}
            </CardDescription>
          </div>
          {selectedSection
            ? (
                <Button variant="outline" size="sm" onClick={() => setSelectedSection(null)}>
                  返回模板属性
                </Button>
              )
            : null}
        </div>
      </CardHeader>
      <CardContent>
        {selectedSection
          ? (
              <TemplateSectionSettings
                manifest={manifest}
                section={selectedSection}
                onChange={applyManifest}
              />
            )
          : (
              <TemplateAppearanceSettings manifest={manifest} onChange={applyManifest} />
            )}
      </CardContent>
    </Card>
  )
}
