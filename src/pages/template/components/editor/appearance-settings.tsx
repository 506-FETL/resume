import type { TemplateManifest } from '@/lib/resume-template/schema'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TEMPLATE_COLOR_PRESET_LABELS, TEMPLATE_DENSITY_LABELS, TEMPLATE_FONT_PRESET_LABELS, TEMPLATE_HEADER_VARIANT_LABELS, TEMPLATE_RADIUS_PRESET_LABELS, TEMPLATE_SKELETON_LABELS, TEMPLATE_SPACING_PRESET_LABELS } from '../../const'
import { getTemplateEditorCapabilities, updateLayoutConfig, updateTemplateMeta, updateTokenConfig } from '../../utils'

interface TemplateAppearanceSettingsProps {
  manifest: TemplateManifest
  onChange: (nextManifest: TemplateManifest) => void
}

function getLabel<T extends string>(labels: Record<string, string>, value: T) {
  return labels[value] ?? value
}

export function TemplateAppearanceSettings({
  manifest,
  onChange,
}: TemplateAppearanceSettingsProps) {
  const capabilities = getTemplateEditorCapabilities(manifest)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-name">模板名称</Label>
        <Input
          id="template-name"
          value={manifest.meta.name}
          onChange={event => onChange(updateTemplateMeta(manifest, { name: event.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-description">模板描述</Label>
        <Textarea
          id="template-description"
          rows={4}
          value={manifest.meta.description ?? ''}
          onChange={event => onChange(updateTemplateMeta(manifest, { description: event.target.value }))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>布局骨架</Label>
          <Select
            value={manifest.layout.skeleton}
            onValueChange={value => onChange(updateLayoutConfig(manifest, { skeleton: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedSkeletons.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_SKELETON_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>头部样式</Label>
          <Select
            value={manifest.layout.headerVariant}
            onValueChange={value => onChange(updateLayoutConfig(manifest, { headerVariant: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedHeaderVariants.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_HEADER_VARIANT_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>密度</Label>
          <Select
            value={manifest.layout.density}
            onValueChange={value => onChange(updateLayoutConfig(manifest, { density: value as TemplateManifest['layout']['density'] }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedDensity.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_DENSITY_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>页面边距预设</Label>
          <Select
            value={manifest.layout.page.pagePaddingToken}
            onValueChange={value =>
              onChange(updateLayoutConfig(manifest, {
                page: {
                  ...manifest.layout.page,
                  pagePaddingToken: value,
                },
              }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">紧凑</SelectItem>
              <SelectItem value="md">标准</SelectItem>
              <SelectItem value="lg">舒展</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>颜色预设</Label>
          <Select
            value={manifest.tokens.colorPreset}
            onValueChange={value => onChange(updateTokenConfig(manifest, { colorPreset: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedTokenPresets.color.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_COLOR_PRESET_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>字体预设</Label>
          <Select
            value={manifest.tokens.fontPreset}
            onValueChange={value => onChange(updateTokenConfig(manifest, { fontPreset: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedTokenPresets.font.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_FONT_PRESET_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>间距预设</Label>
          <Select
            value={manifest.tokens.spacingPreset}
            onValueChange={value => onChange(updateTokenConfig(manifest, { spacingPreset: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedTokenPresets.spacing.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_SPACING_PRESET_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>圆角预设</Label>
          <Select
            value={manifest.tokens.radiusPreset ?? 'none'}
            onValueChange={value => onChange(updateTokenConfig(manifest, { radiusPreset: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.allowedTokenPresets.radius.map(value => (
                <SelectItem key={value} value={value}>
                  {getLabel(TEMPLATE_RADIUS_PRESET_LABELS, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
