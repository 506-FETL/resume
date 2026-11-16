import type { DeclarativeRendererProps } from '../types'
import { use } from 'react'
import { TemplateRegionContext } from '../../template-region-context'
import { createTemplateRenderer } from '../renderer'
import { TemplateResolutionError } from '@/lib/resume-template/definition-schema'
import { routeTemplateSections } from '@/lib/resume-template/declarative/page'

/** 同一解释器用于测量、展示和打印；模板 ID 从不参与结构分派。 */
export function DeclarativeRenderer({
  definition,
  content,
  environment,
  assetUrls,
}: DeclarativeRendererProps) {
  const regionId = use(TemplateRegionContext)

  const renderNodes = createTemplateRenderer({
    definition,
    content,
    environment,
    assetUrls,
  })

  const regions = definition.page.regions.filter(
    (region) => regionId === null || region.id === regionId,
  )

  if (!regions.length)
    throw new TemplateResolutionError(
      'INVALID_DEFINITION',
      '请求的模板区域不存在',
    )

  // 先构造全部配方再选择输出，令字段主投影和展开预算的校验覆盖跨区域重复。
  const renderedRegions = definition.page.regions.map((region) => ({
    id: region.id,
    node: (
      <div
        key={region.id}
        data-template-region={region.id}
        style={{ minWidth: 0 }}
      >
        {renderNodes(region.document ?? definition.document, {
          profile: content.profile,
          sections: routeTemplateSections(definition, content.sections, region),
          region,
        })}
      </div>
    ),
  }))

  return renderedRegions
    .filter((region) => regionId === null || region.id === regionId)
    .map((region) => region.node)
}
