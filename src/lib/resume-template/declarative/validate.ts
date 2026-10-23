import type { Binding, ContentKind, TemplateDefinition, TemplateNode } from './types'
import { DEFAULT_ORDER } from '@/lib/schema'

export const TEMPLATE_LIMITS = { definitionBytes: 256 * 1024, nodes: 512, depth: 16, renderedNodes: 30000 } as const
export const SUPPORTED_TEMPLATE_CAPABILITIES = ['flow', 'local-grid', 'vector-shapes', 'skill-meter', 'images', 'page-regions', 'page-background', 'photo', 'display-bindings', 'item-parity', 'rich-text-styles'] as const
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
  if (['section.title', 'section.key', 'section.index'].includes(binding) && hasSection)
    return
  if (['item.index', 'item.first', 'item.last', 'item.parity'].includes(binding) && ['profile-fields', 'experience-item', 'skills-item', 'field-item'].includes(scope))
    return
  if (binding === 'item.fieldKey' && ['profile-fields', 'skills-item', 'field-item'].includes(scope))
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
  const regionIds = new Set<string>()
  const sectionKeys = new Set<string>()
  if (definition.page.regions.filter(region => region.sections === 'remaining').length !== 1)
    fail('页面必须恰好有一个 remaining 区域')
  definition.page.regions.forEach((region) => {
    if (regionIds.has(region.id))
      fail(`重复区域 ${region.id}`)
    regionIds.add(region.id)
    if (region.sections !== 'remaining') {
      for (const key of region.sections) {
        if (!(DEFAULT_ORDER as readonly string[]).includes(key) || key === 'basics' || key === 'job_intent')
          fail(`无法路由的模块键 ${key}`)
        if (sectionKeys.has(key))
          fail(`重复路由模块 ${key}`)
        sectionKeys.add(key)
      }
    }
  })
  const countSections = (nodes: TemplateNode[]): number => nodes.reduce((count, node) => count + (node.type === 'sections' ? 1 : 'children' in node ? countSections(node.children) : 0), 0)
  if (definition.page.regions.some(region => countSections(region.document ?? definition.document) > 1))
    fail('每个区域的模块集合只能消费一次')
  // 按有效文档累计，继承相同默认配方也会实际渲染两次；条件不视作互斥证明。
  const countProfileTargets = (nodes: TemplateNode[]): number => nodes.reduce((count, node) => count + (node.sectionTarget === 'basics' ? 1 : 0) + ('children' in node ? countProfileTargets(node.children) : 0), 0)
  const effectiveProfileTargets = definition.page.regions.reduce((count, region) => count + countProfileTargets(region.document ?? definition.document), 0)
  if (effectiveProfileTargets > 1)
    fail('个人信息定位标记在所有有效区域中只能出现一次')
  if (definition.page.pattern && definition.page.pattern.radius * 2 > definition.page.pattern.spacing)
    fail('点阵半径不能超过间距的一半')
  if (definition.page.pattern && Math.ceil(794 / definition.page.pattern.spacing) * Math.ceil(1123 / definition.page.pattern.spacing) > TEMPLATE_LIMITS.renderedNodes)
    throw new TemplateValidationError('limit', '点阵重复超过渲染预算')
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
      if (node.type === 'richText' && node.elementStyles) {
        if (!definition.capabilities.includes('rich-text-styles'))
          fail('富文本元素样式需要声明 rich-text-styles 能力')
        for (const styleId of Object.values(node.elementStyles)) {
          if (!Object.hasOwn(definition.styles, styleId))
            fail(`缺少富文本命名样式 ${styleId}`)
          const elementStyle = definition.styles[styleId]
          if (elementStyle.height !== undefined || elementStyle.rotate)
            fail('富文本元素不得使用固定高度或旋转')
        }
      }
      if (node.when) {
        checkBinding(node.when.binding, scope, hasSection)
        if (node.when.operator === 'equals' && node.when.value === undefined)
          fail('相等条件需要 value')
        if (node.when.binding === 'item.parity') {
          if (!definition.capabilities.includes('item-parity'))
            fail('交错布局需要声明 item-parity 能力')
          if (node.when.operator !== 'equals' || !['odd', 'even'].includes(node.when.value ?? ''))
            fail('条目奇偶条件必须比较 odd 或 even')
        }
      }
      if ('binding' in node && node.binding)
        checkBinding(node.binding, scope, hasSection)
      if (node.type === 'text' && (node.text === undefined) === (node.binding === undefined))
        fail('文字节点必须且只能指定 text 或 binding')
      if (node.style && definition.styles[node.style].height !== undefined && !['shape', 'meter', 'image', 'photo'].includes(node.type))
        fail('正文节点不得使用固定高度')
      const style = node.style ? definition.styles[node.style] : undefined
      if (style?.rotate && (!['shape', 'meter', 'image', 'photo'].includes(node.type) || style.width === undefined || style.height === undefined))
        fail('旋转仅用于明确声明宽高的图形、技能条或图片')
      if (node.type === 'shape' && Boolean(node.variants) !== Boolean(node.binding))
        fail('图形映射必须同时声明 binding 和 variants')
      if (node.type === 'text' && (node.map || node.format) && !node.binding)
        fail('文字映射和格式需要绑定')
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
        if ((node.fieldOrder || node.fieldKeys) && !node.source.startsWith('profile.'))
          fail('字段排序仅用于个人信息集合')
        const profileKeys: Record<string, string[]> = {
          'profile.jobIntent': ['jobIntent', 'intentionalCity', 'expectedSalary', 'dateEntry'],
          'profile.meta': ['age', 'gender', 'nation', 'height', 'weight', 'nativePlace', 'maritalStatus', 'politicalStatus'],
          'profile.contact': ['phone', 'email'],
        }
        const allowedFields = node.source === 'profile.fields' ? ['name', 'workYears', ...Object.values(profileKeys).flat()] : profileKeys[node.source] ?? []
        if (node.fieldKeys?.some(key => !allowedFields.includes(key)))
          fail('字段选择包含当前集合未知的字段')
        if (node.fieldKeys && new Set(node.fieldKeys).size !== node.fieldKeys.length)
          fail('字段选择不可重复')
        const itemScope = node.source.startsWith('profile.') ? 'profile-fields' : scope === 'experience' ? 'experience-item' : scope === 'skills' ? 'skills-item' : 'field-item'
        walk(node.children, itemScope, depth + 1, hasSection)
      }
    }
  }
  walk(definition.document, 'document', 1, false)
  walk(definition.section, 'section', 1, true)
  Object.entries(definition.contentByKind).forEach(([kind, nodes]) => walk(nodes, kind as ContentKind, 1, true))
  for (const region of definition.page.regions) {
    // 覆盖配方属于独立命名域；总预算仍跨全部配方累计。
    ids.clear()
    profileTargets = 0
    if (region.document)
      walk(region.document, 'document', 1, false)
    if (region.section)
      walk(region.section, 'section', 1, true)
    Object.entries(region.contentByKind ?? {}).forEach(([kind, nodes]) => walk(nodes, kind as ContentKind, 1, true))
  }
}
