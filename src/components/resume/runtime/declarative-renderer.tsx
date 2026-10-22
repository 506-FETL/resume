import type { ReactNode } from 'react'
import type { AdaptedResumeContent } from '@/lib/resume-template/content/types'
import type { TemplateStyleEnvironment } from '@/lib/resume-template/declarative/styles'
import type { RenderScope, TemplateDefinition, TemplateNode } from '@/lib/resume-template/declarative/types'
import { use } from 'react'
import { CommentableRichText } from '@/components/resume/fields/commentable-rich-text'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { conditionMatches, itemIdentity, resolveBinding, resolveField, resolveList, resolveRichText } from '@/lib/resume-template/declarative/bindings'
import { routeTemplateSections } from '@/lib/resume-template/declarative/page'
import { resolveColor, resolveLayoutStyle, resolveTemplateStyle } from '@/lib/resume-template/declarative/styles'
import { TEMPLATE_LIMITS } from '@/lib/resume-template/declarative/validate'
import { TemplateResolutionError } from '@/lib/resume-template/definition-schema'
import { TemplateRegionContext } from './template-region-context'
import { ShapeView, TemplatePaint } from './template-shapes'

/** 同一解释器用于测量、展示和打印；模板 ID 从不参与结构分派。 */
export function DeclarativeRenderer({ definition, content, environment, assetUrls }: {
  definition: TemplateDefinition
  content: AdaptedResumeContent
  environment: TemplateStyleEnvironment
  assetUrls?: ReadonlyMap<string, string>
}) {
  const regionId = use(TemplateRegionContext)
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
    return nodes.map((node) => {
      const rendered = renderNode(node, scope)
      const rotation = node.style ? definition.styles[node.style].rotate : undefined
      if (!rotation || rendered === null)
        return rendered
      const style = resolveTemplateStyle(definition.styles[node.style!], environment)
      const width = Number.parseFloat(String(style.width))
      const height = Number.parseFloat(String(style.height))
      const radians = Math.abs(rotation) * Math.PI / 180
      const outerWidth = width * Math.cos(radians) + height * Math.sin(radians)
      const outerHeight = width * Math.sin(radians) + height * Math.cos(radians)
      chargeNodes(2)
      return <div key={node.id} data-pagination-atomic data-template-rotated style={{ position: 'relative', width: outerWidth, height: outerHeight, flexShrink: 0, marginTop: style.marginTop, marginRight: style.marginRight, marginBottom: style.marginBottom, marginLeft: style.marginLeft }}><div style={{ position: 'absolute', left: (outerWidth - width) / 2, top: (outerHeight - height) / 2, width, height, transform: `rotate(${rotation}deg)` }}>{rendered}</div></div>
    })
  }
  function renderNode(node: TemplateNode, scope: RenderScope): ReactNode {
    if (!conditionMatches(node.when, scope))
      return null
    chargeNodes(1)
    const style = resolveTemplateStyle(node.style ? definition.styles[node.style] : undefined, environment)
    if (node.style && definition.styles[node.style].rotate) {
      style.marginTop = style.marginRight = style.marginBottom = style.marginLeft = 0
    }
    if (style.backgroundColor)
      chargeNodes(2)
    const paint = <TemplatePaint style={style} />
    const common = { 'data-pagination-keep-with-next': node.keepWithNext || undefined, 'id': node.sectionTarget ? `resume-section-${node.sectionTarget}` : undefined, 'data-section': node.sectionTarget, 'data-layout-node': node.id, 'data-pagination-atomic': node.atomic || undefined }
    switch (node.type) {
      case 'box': {
        const children = renderNodes(node.children, scope)
        if (!node.decoration?.length && children.every(child => child === null))
          return null
        if (node.decoration?.length)
          chargeNodes(1 + node.decoration.length)
        return (
          <div key={node.id} {...common} style={{ minWidth: 0, position: 'relative', isolation: 'isolate', ...resolveLayoutStyle(node.layout), ...style }}>
            {paint}
            {node.decoration && node.viewBox && <ShapeView shapes={node.decoration} viewBox={node.viewBox} environment={environment} style={{ position: 'absolute', inset: 0 }} />}
            {children}
          </div>
        )
      }
      case 'text': {
        const value = node.text ?? String(resolveBinding(node.binding!, scope) ?? '')
        if (!value)
          return null
        const mapped = node.map && Object.hasOwn(node.map, value) ? node.map[value] : value
        const text = node.format === 'pad2' ? mapped.padStart(2, '0') : mapped
        if (!text)
          return null
        return (
          <span key={node.id} {...common} style={{ position: 'relative', isolation: 'isolate', overflowWrap: 'anywhere', ...style }}>
            {paint}
            {text}
          </span>
        )
      }
      case 'field': {
        const field = resolveField(node.binding, scope)
        if (!field?.text.trim())
          return null
        claimProjection(field.nodeKey, node.projection)
        chargeNodes(1 + (node.showLabel ? 1 : 0))
        return (
          <span key={node.id} {...common} style={{ position: 'relative', isolation: 'isolate', minWidth: 0, overflowWrap: 'anywhere', ...style }}>
            {paint}
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
          <div key={node.id} {...common} style={{ position: 'relative', isolation: 'isolate', minWidth: 0, ...style }}>
            {paint}
            <CommentableRichText nodeKey={richText.field.nodeKey} fieldLabel={richText.field.label} html={richText.html} projection={node.projection} style={{ fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }} />
          </div>
        )
      }
      case 'repeat': {
        const items = resolveList(node.source, scope, node.fieldOrder, node.fieldKeys)
        if (!items.length)
          return null
        const renderedItems = items.map((item, itemIndex) => ({ identity: itemIdentity(item), children: renderNodes(node.children, { ...scope, item, itemIndex, itemCount: items.length }) })).filter(item => item.children.some(child => child !== null))
        if (!renderedItems.length)
          return null
        chargeNodes(renderedItems.length)
        if (node.separator)
          chargeNodes(Math.max(0, renderedItems.length - 1))
        return (
          <div key={node.id} {...common} style={{ position: 'relative', isolation: 'isolate', minWidth: 0, ...resolveLayoutStyle(node.layout), ...style }}>
            {paint}
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
        if (!(scope.sections ?? []).length)
          return null
        chargeNodes((scope.sections ?? []).length)
        return (
          <div key={node.id} {...common} style={{ position: 'relative', isolation: 'isolate', display: 'flex', flexDirection: 'column', gap: `${environment.numbers.sectionSpacing}px`, ...style }}>
            {paint}
            {(scope.sections ?? []).map((section, sectionIndex) => (
              <section key={section.key} id={`resume-section-${section.key}`} data-section={section.key} style={{ minWidth: 0 }}>
                {renderNodes(scope.region?.section ?? definition.section, { ...scope, section, sectionIndex })}
              </section>
            ))}
          </div>
        )
      case 'blocks':
        if (!scope.section?.blocks.length)
          return null
        chargeNodes(scope.section?.blocks.length ?? 0)
        return (
          <div key={node.id} {...common} style={{ position: 'relative', isolation: 'isolate', display: 'flex', flexDirection: 'column', gap: `${environment.numbers.entrySpacing}px`, ...style }}>
            {paint}
            {scope.section?.blocks.map((block, index) => <div key={`${block.kind}-${index}`} data-content-kind={block.kind}>{renderNodes(scope.region?.contentByKind?.[block.kind] ?? definition.contentByKind[block.kind], { ...scope, block })}</div>)}
          </div>
        )
      case 'shape': {
        const variant = node.binding ? String(resolveBinding(node.binding, scope) ?? '') : ''
        const shapes = node.variants && Object.hasOwn(node.variants, variant) ? node.variants[variant] : node.shapes
        if (!shapes.length)
          return null
        chargeNodes(1 + shapes.length)
        return (
          <div key={node.id} {...common} data-resume-decoration aria-hidden="true" style={{ position: 'relative', isolation: 'isolate', minWidth: 0, ...style }}>
            {paint}
            <ShapeView shapes={shapes} viewBox={node.viewBox} environment={environment} />
          </div>
        )
      }
      case 'meter': {
        chargeNodes(3)
        const value = Number(resolveBinding(node.binding, scope))
        return (
          <div key={node.id} {...common} data-resume-decoration aria-hidden="true" style={{ position: 'relative', flexGrow: 1, height: 6, ...style }}>
            <svg width="100%" height="100%" style={{ display: 'block', borderRadius: style.borderRadius, overflow: 'hidden' }}>
              <rect width="100%" height="100%" fill={resolveColor(node.track, environment)} />
              <rect width={`${Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0}%`} height="100%" fill={resolveColor(node.fill, environment)} />
            </svg>
          </div>
        )
      }
      case 'photo': {
        const photo = scope.profile?.photo
        if (!photo)
          return null
        return <img key={node.id} {...common} data-resume-photo src={photo.dataUrl} alt={node.alt ?? '个人照片'} width={photo.width} height={photo.height} style={{ display: 'block', maxWidth: '100%', objectFit: 'cover', flexShrink: 0, ...style }} />
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
  const regions = definition.page.regions.filter(region => regionId === null || region.id === regionId)
  if (!regions.length)
    throw new TemplateResolutionError('INVALID_DEFINITION', '请求的模板区域不存在')
  // 先构造全部配方再选择输出，令字段主投影和展开预算的校验覆盖跨区域重复。
  const renderedRegions = definition.page.regions.map(region => ({
    id: region.id,
    node: <div key={region.id} data-template-region={region.id} style={{ minWidth: 0 }}>{renderNodes(region.document ?? definition.document, { profile: content.profile, sections: routeTemplateSections(definition, content.sections, region), region })}</div>,
  }))
  return renderedRegions.filter(region => regionId === null || region.id === regionId).map(region => region.node)
}
