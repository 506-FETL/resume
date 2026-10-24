import type { ContentSection } from '../content/types'
import type { TemplateDefinition, TemplateRegion } from './types'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { TemplateResolutionError } from '../definition-schema'
import {
  createTemplateStyleEnvironment,
  resolveColor,
  resolveNumeric,
} from './styles'

// CSS px 换算保持与 @page A4 以及 210mm × 297mm 的打印容器一致。
export const TEMPLATE_PAGE_WIDTH = (210 * 96) / 25.4

export const TEMPLATE_PAGE_HEIGHT = (297 * 96) / 25.4

export interface ResolvedTemplateRegion {
  id: string
  left: number
  top: number
  width: number
  height: number
  outerLeft: number
  outerTop: number
  outerWidth: number
  outerHeight: number
  background?: string
}

export function resolveTemplatePage(
  definition: TemplateDefinition,
  appearance: ResumeAppearanceConfig,
) {
  const environment = createTemplateStyleEnvironment(definition, appearance)
  const margin = definition.page.fullBleed ? 0 : appearance.spacing.pageMargin

  const innerWidth =
    TEMPLATE_PAGE_WIDTH -
    2 * margin -
    definition.page.gap * (definition.page.regions.length - 1)

  const innerHeight = TEMPLATE_PAGE_HEIGHT - 2 * margin

  const totalWeight = definition.page.regions.reduce(
    (sum, region) => sum + region.width,
    0,
  )

  let left = margin

  const regions: ResolvedTemplateRegion[] = definition.page.regions.map(
    (region) => {
      const width = (innerWidth * region.width) / totalWeight

      const [topPad, rightPad, bottomPad, leftPad] = (
        region.padding ?? [0, 0, 0, 0]
      ).map((value) => Math.max(0, resolveNumeric(value, environment)))

      const geometry = {
        id: region.id,
        left: left + leftPad,
        top: margin + topPad,
        width: width - leftPad - rightPad,
        height: innerHeight - topPad - bottomPad,
        outerLeft: left,
        outerTop: margin,
        outerWidth: width,
        outerHeight: innerHeight,
        background: region.background
          ? resolveColor(region.background, environment)
          : undefined,
      }

      if (geometry.width < 1 || geometry.height < 1)
        throw new TemplateResolutionError(
          'INVALID_DEFINITION',
          '模板区域内边距超出可用纸张尺寸',
        )

      left += width + definition.page.gap

      return geometry
    },
  )

  return {
    regions,
    fullBleed: definition.page.fullBleed,
    background: definition.page.background
      ? resolveColor(definition.page.background, environment)
      : undefined,
  }
}

/** 按语义键分区，filter 保留适配层已经确定的用户顺序。 */
export function routeTemplateSections(
  definition: TemplateDefinition,
  sections: ContentSection[],
  region: TemplateRegion,
): ContentSection[] {
  const assigned = new Set(
    definition.page.regions.flatMap((item) =>
      item.sections === 'remaining' ? [] : item.sections,
    ),
  )

  return sections.filter((section) =>
    region.sections === 'remaining'
      ? !assigned.has(section.key)
      : region.sections.includes(section.key),
  )
}
