import type { TemplateManifest, TemplateSection } from '@/lib/resume-template/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TEMPLATE_SECTION_LABELS } from '../../const'
import { canTemplateSectionDelete, getTemplateEditorCapabilities, getTemplateSectionVariants, isTemplateSectionLocked, isTemplateSectionRequired, moveSectionRegion, removeSection, toggleSectionVisibility, updateSectionVariant } from '../../utils'

interface TemplateSectionSettingsProps {
  manifest: TemplateManifest
  section: TemplateSection
  onChange: (nextManifest: TemplateManifest) => void
}

export function TemplateSectionSettings({
  manifest,
  section,
  onChange,
}: TemplateSectionSettingsProps) {
  const capabilities = getTemplateEditorCapabilities(manifest)
  const allowedRegions = capabilities.allowedRegionsBySection[section.sectionId]
    ?? capabilities.allowedRegionsBySection[section.renderer]
    ?? ['main']
  const variants = getTemplateSectionVariants(manifest, section)
  const locked = isTemplateSectionLocked(manifest, section.sectionId)
  const required = isTemplateSectionRequired(manifest, section.sectionId)
  const removable = canTemplateSectionDelete(manifest, section.sectionId)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">
            {TEMPLATE_SECTION_LABELS[section.renderer] ?? section.renderer}
          </h3>
          {required ? <Badge variant="secondary">必选</Badge> : null}
          {locked ? <Badge variant="outline">锁定</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          renderer：
          {section.renderer}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>区域</Label>
        <Select
          value={section.region}
          onValueChange={value =>
            onChange(moveSectionRegion(manifest, section.sectionId, value as TemplateSection['region']))}
          disabled={locked}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedRegions.map(value => (
              <SelectItem key={value} value={value}>
                {value === 'main' ? '主栏' : '侧栏'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>展示样式</Label>
        <Select
          value={section.variant ?? variants[0] ?? 'default'}
          onValueChange={value => onChange(updateSectionVariant(manifest, section.sectionId, value))}
          disabled={locked || variants.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {variants.map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="font-medium">显示模块</p>
          <p className="text-sm text-muted-foreground">必选或锁定模块不能隐藏。</p>
        </div>
        <Switch
          checked={section.visible}
          onCheckedChange={() => onChange(toggleSectionVisibility(manifest, section.sectionId))}
          disabled={required || locked}
        />
      </div>

      <Button
        variant="outline"
        className="w-full"
        disabled={!removable}
        onClick={() => onChange(removeSection(manifest, section.sectionId))}
      >
        删除模块
      </Button>
    </div>
  )
}
