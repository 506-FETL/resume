import type { Binding, ContentKind, TemplateDefinition, TemplateNode } from './types'

export const TEMPLATE_LIMITS = { definitionBytes: 256 * 1024, nodes: 512, depth: 16, renderedNodes: 30000 } as const
export const SUPPORTED_TEMPLATE_CAPABILITIES = ['flow', 'local-grid', 'vector-shapes', 'skill-meter', 'images'] as const
export class TemplateValidationError extends Error {
  readonly reason: 'capability' | 'limit' | 'definition'
  constructor(reason: 'capability' | 'limit' | 'definition', message: string) {
    super(message)
    this.reason = reason
  }
}
function fail(message: string): never {
  throw new TemplateValidationError('definition', message)
}
type Scope = 'document' | 'section' | ContentKind | 'profile-fields' | 'experience-item' | 'skills-item' | 'field-item'
function checkBinding(binding: Binding, scope: Scope, hasSection: boolean) {
  if (binding.startsWith('profile.') || binding === 'profile' || binding === 'sections')
    return
  if (binding === 'section.title' && hasSection)
    return
  if (binding === 'block.items' && ['experience', 'skills', 'fieldList', 'tagList'].includes(scope))
    return
  if (binding === 'block.richText' && scope === 'richText')
    return
  if (['item.title', 'item.subtitle', 'item.duration', 'item.description'].includes(binding) && scope === 'experience-item')
    return
  if (['item.field', 'item.percentage', 'item.proficiency', 'item.displayType'].includes(binding) && scope === 'skills-item')
    return
  if ((binding === 'item' && ['field-item', 'profile-fields'].includes(scope)) || (binding === 'item.label' && ['field-item', 'profile-fields', 'skills-item'].includes(scope)))
    return
  fail(`绑定 ${binding} 不适用于 ${scope} 作用域`)
}
export function validateTemplateDefinition(definition: TemplateDefinition): void {
  if (new TextEncoder().encode(JSON.stringify(definition)).byteLength > TEMPLATE_LIMITS.definitionBytes)
    throw new TemplateValidationError('limit', '模板定义超过大小预算')
  if (definition.capabilities.some(capability => !(SUPPORTED_TEMPLATE_CAPABILITIES as readonly string[]).includes(capability)))
    throw new TemplateValidationError('capability', '模板要求尚未支持的能力')
  const assets = new Set<string>()
  definition.assets.forEach((asset) => {
    if (assets.has(asset.id))
      fail(`重复素材 ${asset.id}`)
    assets.add(asset.id)
  })
  let count = 0
  let profileTargets = 0
  const ids = new Set<string>()
  const walk = (nodes: TemplateNode[], scope: Scope, depth: number, hasSection: boolean) => {
    if (depth > TEMPLATE_LIMITS.depth)
      throw new TemplateValidationError('limit', '模板嵌套超过深度预算')
    for (const node of nodes) {
      if (++count > TEMPLATE_LIMITS.nodes)
        throw new TemplateValidationError('limit', '模板节点超过数量预算')
      if (ids.has(node.id))
        fail(`重复布局节点 ${node.id}`)
      ids.add(node.id)
      if (node.sectionTarget) {
        if (scope !== 'document' || node.type !== 'box' || ++profileTargets > 1)
          fail('个人信息定位标记仅允许出现在唯一的文档容器中')
      }
      if (node.style && !Object.hasOwn(definition.styles, node.style))
        fail(`缺少命名样式 ${node.style}`)
      if (node.when) {
        checkBinding(node.when.binding, scope, hasSection)
        if (node.when.operator === 'equals' && node.when.value === undefined)
          fail('相等条件需要 value')
      }
      if ('binding' in node && node.binding)
        checkBinding(node.binding, scope, hasSection)
      if (node.type === 'text' && (node.text === undefined) === (node.binding === undefined))
        fail('文字节点必须且只能指定 text 或 binding')
      if (node.style && definition.styles[node.style].height !== undefined && !['shape', 'meter', 'image'].includes(node.type))
        fail('正文节点不得使用固定高度')
      if (node.type === 'image' && !assets.has(node.asset))
        fail(`缺少素材 ${node.asset}`)
      if (node.type === 'sections' && scope !== 'document')
        fail('sections 仅允许在文档配方中使用')
      if (node.type === 'blocks' && scope !== 'section')
        fail('blocks 仅允许在模块配方中使用')
      if (node.type === 'box') {
        if (node.decoration?.length && !node.viewBox)
          fail('装饰必须声明 viewBox')
        walk(node.children, scope, depth + 1, hasSection)
      }
      if (node.type === 'repeat') {
        checkBinding(node.source, scope, hasSection)
        if (node.fieldOrder && !node.source.startsWith('profile.'))
          fail('字段排序仅用于个人信息集合')
        const itemScope = node.source.startsWith('profile.') ? 'profile-fields' : scope === 'experience' ? 'experience-item' : scope === 'skills' ? 'skills-item' : 'field-item'
        walk(node.children, itemScope, depth + 1, hasSection)
      }
    }
  }
  walk(definition.document, 'document', 1, false)
  walk(definition.section, 'section', 1, true)
  Object.entries(definition.contentByKind).forEach(([kind, nodes]) => walk(nodes, kind as ContentKind, 1, true))
}
