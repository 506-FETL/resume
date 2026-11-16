import type { DeclarativeRendererProps, TemplateRenderContext } from './types'
import { TEMPLATE_LIMITS } from '@/lib/resume-template/declarative/validate'
import { TemplateResolutionError } from '@/lib/resume-template/definition-schema'
import { completeProfileFields } from '@/lib/resume-template/declarative/complete-profile-fields'
import type {
  TemplateNode,
  RenderScope,
} from '@/lib/resume-template/declarative/types'
import type { ReactNode } from 'react'
import { resolveTemplateStyle } from '@/lib/resume-template/declarative/styles'
import { conditionMatches } from '@/lib/resume-template/declarative/bindings'
import { TemplatePaint } from '../template-shapes'
import { renderTextNode } from './text'
import { renderMediaNode } from './media'
import { renderCollectionsNode } from './collections'

export function createTemplateRenderer({
  definition,
  content,
  environment,
  assetUrls,
}: DeclarativeRendererProps) {
  let renderedNodes = 0

  const chargeNodes = (count: number) => {
    renderedNodes += count

    if (renderedNodes > TEMPLATE_LIMITS.renderedNodes)
      throw new TemplateResolutionError(
        'RESOURCE_LIMIT',
        '简历展开超过渲染预算，请减少内容或更换模板',
      )
  }

  const primaryFields = new Set<string>()
  const additionalProfileFields = completeProfileFields(definition, content)

  const claimProjection = (key: string, projection = 'primary') => {
    if (projection !== 'primary') return
    if (primaryFields.has(key))
      throw new TemplateResolutionError(
        'INVALID_DEFINITION',
        '同一字段存在多个主评论投影，请联系模板维护者',
      )

    primaryFields.add(key)
  }

  const context: TemplateRenderContext = {
    definition,
    environment,
    assetUrls,
    additionalProfileFields,
    chargeNodes,
    claimProjection,
  }

  function renderNodes(nodes: TemplateNode[], scope: RenderScope): ReactNode[] {
    return nodes.map((node) => {
      const rendered = renderNode(node, scope)

      const rotation = node.style
        ? definition.styles[node.style].rotate
        : undefined

      if (!rotation || rendered === null) return rendered

      const style = resolveTemplateStyle(
        definition.styles[node.style!],
        environment,
      )

      const width = Number.parseFloat(String(style.width))
      const height = Number.parseFloat(String(style.height))
      const radians = (Math.abs(rotation) * Math.PI) / 180
      const outerWidth = width * Math.cos(radians) + height * Math.sin(radians)
      const outerHeight = width * Math.sin(radians) + height * Math.cos(radians)

      chargeNodes(2)

      return (
        <div
          key={node.id}
          data-pagination-atomic
          data-template-rotated
          style={{
            position: 'relative',
            width: outerWidth,
            height: outerHeight,
            flexShrink: 0,
            marginTop: style.marginTop,
            marginRight: style.marginRight,
            marginBottom: style.marginBottom,
            marginLeft: style.marginLeft,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: (outerWidth - width) / 2,
              top: (outerHeight - height) / 2,
              width,
              height,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {rendered}
          </div>
        </div>
      )
    })
  }

  function renderNode(node: TemplateNode, scope: RenderScope): ReactNode {
    if (!conditionMatches(node.when, scope)) return null

    chargeNodes(1)

    const style = resolveTemplateStyle(
      node.style ? definition.styles[node.style] : undefined,
      environment,
    )

    if (node.style && definition.styles[node.style].rotate) {
      style.marginTop =
        style.marginRight =
        style.marginBottom =
        style.marginLeft =
          0
    }
    if (style.backgroundColor) chargeNodes(2)

    const paint = <TemplatePaint style={style} />

    const common = {
      'data-pagination-keep-with-next': node.keepWithNext || undefined,
      id: node.sectionTarget
        ? `resume-section-${node.sectionTarget}`
        : undefined,
      'data-section': node.sectionTarget,
      'data-layout-node': node.id,
      'data-pagination-atomic': node.atomic || undefined,
    }

    switch (node.type) {
      case 'text':
      case 'field':
      case 'richText':
        return renderTextNode(node, scope, context, { style, common, paint })
      case 'shape':
      case 'meter':
      case 'photo':
      case 'image':
        return renderMediaNode(node, scope, context, { style, common, paint })
      case 'box':
      case 'repeat':
      case 'sections':
      case 'blocks':
        return renderCollectionsNode(
          node,
          scope,
          context,
          { style, common, paint },
          renderNodes,
        )
    }
  }

  return renderNodes
}
