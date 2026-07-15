import type { TemplateManifest } from '@/lib/resume-template/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TEMPLATE_SECTION_LABELS } from '../../const'
import { addSection, canTemplateSectionMoveToRegion, getTemplateEditorCapabilities } from '../../utils'

interface TemplateSectionPaletteProps {
  manifest: TemplateManifest
  onChange: (nextManifest: TemplateManifest) => void
}

export function TemplateSectionPalette({
  manifest,
  onChange,
}: TemplateSectionPaletteProps) {
  const capabilities = getTemplateEditorCapabilities(manifest)
  const existingSectionIds = new Set(manifest.sections.map(section => section.sectionId))
  const paletteSections = capabilities.sectionPalette.filter(sectionId => !existingSectionIds.has(sectionId))

  if (paletteSections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        当前 family 的可选模块已经全部加入。
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {paletteSections.map((sectionId) => {
        const nextSection = {
          sectionId,
          renderer: sectionId,
          region: canTemplateSectionMoveToRegion(manifest, { sectionId, renderer: sectionId }, 'main')
            ? 'main'
            : 'sidebar',
          visible: true,
        } as const

        return (
          <div key={sectionId} className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{TEMPLATE_SECTION_LABELS[sectionId] ?? sectionId}</span>
              <Badge variant="secondary">可添加</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(addSection(manifest, nextSection))}
            >
              添加
            </Button>
          </div>
        )
      })}
    </div>
  )
}
