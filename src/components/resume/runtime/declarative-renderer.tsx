import type { CSSProperties, ReactNode } from 'react'
import type { AdaptedResumeContent } from '@/lib/resume-template/content/types'
import type { TemplateStyleEnvironment } from '@/lib/resume-template/declarative/styles'
import type { RenderScope, TemplateDefinition, TemplateNode, TemplateShape } from '@/lib/resume-template/declarative/types'
import { CommentableRichText } from '@/components/resume/fields/commentable-rich-text'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { conditionMatches, itemIdentity, resolveBinding, resolveField, resolveList, resolveRichText } from '@/lib/resume-template/declarative/bindings'
import { resolveColor, resolveLayoutStyle, resolveTemplateStyle } from '@/lib/resume-template/declarative/styles'
import { TEMPLATE_LIMITS } from '@/lib/resume-template/declarative/validate'
import { TemplateResolutionError } from '@/lib/resume-template/definition-schema'

function ShapeView({ shapes, viewBox, environment, style }: { shapes: TemplateShape[], viewBox: [number, number, number, number], environment: TemplateStyleEnvironment, style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" data-resume-decoration viewBox={viewBox.join(' ')} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', ...style }}>
      {shapes.map((shape, index) => {
        const paint = { fill: shape.fill ? resolveColor(shape.fill, environment) : 'none', stroke: shape.stroke ? resolveColor(shape.stroke, environment) : undefined, strokeWidth: shape.strokeWidth, vectorEffect: 'non-scaling-stroke' as const }
        if (shape.kind === 'path')
          return <path key={index} d={shape.d} {...paint} />
        if (shape.kind === 'circle')
          return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.radius} {...paint} />
        return <rect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.radius} {...paint} />
      })}
    </svg>
  )
}

/** 同一解释器用于测量、展示和打印；模板 ID 从不参与结构分派。 */
export function DeclarativeRenderer({ definition, content, environment, assetUrls }: {
  definition: TemplateDefinition
  content: AdaptedResumeContent
  environment: TemplateStyleEnvironment
  assetUrls?: ReadonlyMap<string, string>
}) {
  let renderedNodes = 0
  const chargeNodes = (count: number) => {
    renderedNodes += count
    if (renderedNodes > TEMPLATE_LIMITS.renderedNodes)
      throw new TemplateResolutionError('RESOURCE_LIMIT', '简历展开超过渲染预算，请减少内容或更换模板')
  }
  const primaryFields = new Set<string>()
  const claimProjection = (key: string, projection = 'primary') => {
    if (projection !== 'primary')
      return
    if (primaryFields.has(key))
      throw new TemplateResolutionError('INVALID_DEFINITION', '同一字段存在多个主评论投影，请联系模板维护者')
    primaryFields.add(key)
  }
  function renderNodes(nodes: TemplateNode[], scope: RenderScope): ReactNode[] {
    return nodes.map(node => renderNode(node, scope))
  }
  function renderNode(node: TemplateNode, scope: RenderScope): ReactNode {
    if (!conditionMatches(node.when, scope))
      return null
    chargeNodes(1)
    const style = resolveTemplateStyle(node.style ? definition.styles[node.style] : undefined, environment)
    const common = { 'id': node.sectionTarget ? `resume-section-${node.sectionTarget}` : undefined, 'data-section': node.sectionTarget, 'data-layout-node': node.id, 'data-pagination-atomic': node.atomic || undefined }
    switch (node.type) {
      case 'box': {
        const children = renderNodes(node.children, scope)
        if (!node.decoration?.length && children.every(child => child === null))
          return null
        if (node.decoration?.length)
          chargeNodes(1 + node.decoration.length)
        return (
          <div key={node.id} {...common} style={{ minWidth: 0, position: 'relative', ...resolveLayoutStyle(node.layout), ...style }}>
            {node.decoration && node.viewBox && <ShapeView shapes={node.decoration} viewBox={node.viewBox} environment={environment} style={{ position: 'absolute', inset: 0 }} />}
            {children}
          </div>
        )
      }
      case 'text': {
        const text = node.text ?? String(resolveBinding(node.binding!, scope) ?? '')
        if (!text)
          return null
        return <span key={node.id} {...common} style={{ position: 'relative', overflowWrap: 'anywhere', ...style }}>{text}</span>
      }
      case 'field': {
        const field = resolveField(node.binding, scope)
        if (!field?.text.trim())
          return null
        claimProjection(field.nodeKey, node.projection)
        chargeNodes(1 + (node.showLabel ? 1 : 0))
        return (
          <span key={node.id} {...common} style={{ position: 'relative', minWidth: 0, overflowWrap: 'anywhere', ...style }}>
            {node.showLabel && (
              <span>
                {field.label}
                ：
              </span>
            )}
            <CommentableText nodeKey={field.nodeKey} fieldLabel={field.label} projection={node.projection}>{field.text}</CommentableText>
            {node.suffix}
          </span>
        )
      }
      case 'richText': {
        const richText = resolveRichText(node.binding, scope)
        if (!richText?.field.text.trim())
          return null
        claimProjection(richText.field.nodeKey, node.projection)
        // 富文本沿用净化与投影链路；预算按原始标签计数可安全高估，不静默截断正文。
        chargeNodes(1 + (richText.html.match(/<[a-z][^>]*>/gi)?.length ?? 0))
        return (
          <div key={node.id} {...common} style={{ minWidth: 0, ...style }}>
            <CommentableRichText nodeKey={richText.field.nodeKey} fieldLabel={richText.field.label} html={richText.html} projection={node.projection} style={{ fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }} />
          </div>
        )
      }
      case 'repeat': {
        const items = resolveList(node.source, scope, node.fieldOrder)
        if (!items.length)
          return null
        const renderedItems = items.map(item => ({ identity: itemIdentity(item), children: renderNodes(node.children, { ...scope, item }) })).filter(item => item.children.some(child => child !== null))
        if (!renderedItems.length)
          return null
        chargeNodes(renderedItems.length)
        if (node.separator)
          chargeNodes(Math.max(0, renderedItems.length - 1))
        return (
          <div key={node.id} {...common} style={{ minWidth: 0, ...resolveLayoutStyle(node.layout), ...style }}>
            {renderedItems.map((item, index) => (
              <div key={item.identity} data-template-entry={item.identity} style={{ minWidth: 0, display: node.layout === 'row' || node.layout === 'wrap' ? 'flex' : undefined, alignItems: 'baseline', columnGap: style.columnGap ?? style.gap }}>
                {index > 0 && node.separator && <span aria-hidden="true" data-resume-decoration>{node.separator}</span>}
                {item.children}
              </div>
            ))}
          </div>
        )
      }
      case 'sections':
        if (!content.sections.length)
          return null
        chargeNodes(content.sections.length)
        return (
          <div key={node.id} {...common} style={{ display: 'flex', flexDirection: 'column', gap: `${environment.numbers.sectionSpacing}px`, ...style }}>
            {content.sections.map(section => (
              <section key={section.key} id={`resume-section-${section.key}`} data-section={section.key} style={{ minWidth: 0 }}>
                {renderNodes(definition.section, { ...scope, section })}
              </section>
            ))}
          </div>
        )
      case 'blocks':
        if (!scope.section?.blocks.length)
          return null
        chargeNodes(scope.section?.blocks.length ?? 0)
        return (
          <div key={node.id} {...common} style={{ display: 'flex', flexDirection: 'column', gap: `${environment.numbers.entrySpacing}px`, ...style }}>
            {scope.section?.blocks.map((block, index) => <div key={`${block.kind}-${index}`} data-content-kind={block.kind}>{renderNodes(definition.contentByKind[block.kind], { ...scope, block })}</div>)}
          </div>
        )
      case 'shape':
        chargeNodes(1 + node.shapes.length)
        return <div key={node.id} {...common} data-resume-decoration aria-hidden="true" style={{ position: 'relative', minWidth: 0, ...style }}><ShapeView shapes={node.shapes} viewBox={node.viewBox} environment={environment} /></div>
      case 'meter': {
        chargeNodes(1)
        const value = Number(resolveBinding(node.binding, scope))
        return <div key={node.id} {...common} data-resume-decoration aria-hidden="true" style={{ flexGrow: 1, height: 6, backgroundColor: resolveColor(node.track, environment), ...style }}><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: resolveColor(node.fill, environment), borderRadius: 'inherit' }} /></div>
      }
      case 'image': {
        const asset = definition.assets.find(asset => asset.id === node.asset)!
        const url = assetUrls?.get(asset.id)
        if (!url) {
          if (asset.required)
            throw new TemplateResolutionError('LOAD_FAILED', '模板必需素材尚未就绪')
          return null
        }
        if (!url.startsWith('blob:'))
          throw new TemplateResolutionError('INVALID_DEFINITION', '模板素材必须由校验后的本地资源呈现')
        return <img key={node.id} {...common} data-resume-decoration src={url} alt={node.alt} width={asset.width} height={asset.height} style={{ display: 'block', maxWidth: '100%', ...style }} />
      }
    }
  }
  return renderNodes(definition.document, { profile: content.profile, sections: content.sections })
}
