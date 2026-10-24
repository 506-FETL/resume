import type { BindingScope } from './binding-registry'
import type { Binding, ListBinding, TemplateNode } from './types'
import type { NodeValidationContext } from './validation-context'
import { isBindingAllowed } from './binding-registry'
import { fail } from './validation-context'

function checkBinding(binding: Binding, { scope, hasSection }: NodeValidationContext) {
  if (!isBindingAllowed(binding, scope, hasSection))
    fail(`绑定 ${binding} 不适用于 ${scope} 作用域`)
}

const fixedSizeNodes: ReadonlySet<TemplateNode['type']> = new Set(['shape', 'meter', 'image', 'photo'])

/** 所有节点都会执行的约束；资源预算和 ID 命名域由外层遍历维护。 */
export function validateCommonNode(node: TemplateNode, context: NodeValidationContext): void {
  const { definition } = context
  if (node.style && !Object.hasOwn(definition.styles, node.style))
    fail(`缺少命名样式 ${node.style}`)
  if (node.when) {
    checkBinding(node.when.binding, context)
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
    checkBinding(node.binding, context)
  const style = node.style ? definition.styles[node.style] : undefined
  if (style?.height !== undefined && !fixedSizeNodes.has(node.type))
    fail('正文节点不得使用固定高度')
  if (style?.rotate && (!fixedSizeNodes.has(node.type) || style.width === undefined || style.height === undefined))
    fail('旋转仅用于明确声明宽高的图形、技能条或图片')
}

function validateText(node: Extract<TemplateNode, { type: 'text' }>): void {
  if ((node.text === undefined) === (node.binding === undefined))
    fail('文字节点必须且只能指定 text 或 binding')
  if ((node.map || node.format) && !node.binding)
    fail('文字映射和格式需要绑定')
}

function validateRichText(node: Extract<TemplateNode, { type: 'richText' }>, { definition }: NodeValidationContext): void {
  if (!node.elementStyles)
    return
  if (!definition.capabilities.includes('rich-text-styles'))
    fail('富文本元素样式需要声明 rich-text-styles 能力')
  for (const styleId of Object.values(node.elementStyles)) {
    if (!Object.hasOwn(definition.styles, styleId))
      fail(`缺少富文本命名样式 ${styleId}`)
    const style = definition.styles[styleId]
    if (style.height !== undefined || style.rotate)
      fail('富文本元素不得使用固定高度或旋转')
  }
}

const profileKeys = {
  'profile.jobIntent': ['jobIntent', 'intentionalCity', 'expectedSalary', 'dateEntry'],
  'profile.meta': ['age', 'gender', 'nation', 'height', 'weight', 'nativePlace', 'maritalStatus', 'politicalStatus'],
  'profile.contact': ['phone', 'email'],
}
const listFieldKeys: Record<ListBinding, readonly string[]> = {
  ...profileKeys,
  'profile.fields': ['name', 'workYears', ...Object.values(profileKeys).flat()],
  'block.items': [],
}
const blockItemScopes: Partial<Record<BindingScope, BindingScope>> = {
  experience: 'experience-item',
  skills: 'skills-item',
}

function validateRepeat(node: Extract<TemplateNode, { type: 'repeat' }>, context: NodeValidationContext): BindingScope {
  checkBinding(node.source, context)
  const isProfile = node.source.startsWith('profile.')
  if ((node.fieldOrder || node.fieldKeys) && !isProfile)
    fail('字段排序仅用于个人信息集合')
  if (node.fieldKeys?.some(key => !listFieldKeys[node.source].includes(key)))
    fail('字段选择包含当前集合未知的字段')
  if (node.fieldKeys && new Set(node.fieldKeys).size !== node.fieldKeys.length)
    fail('字段选择不可重复')
  return isProfile ? 'profile-fields' : blockItemScopes[context.scope] ?? 'field-item'
}

/** 保留判别联合分派以获得类型收窄，各规则只负责本类节点。 */
export function validateSpecificNode(node: TemplateNode, context: NodeValidationContext): BindingScope | undefined {
  switch (node.type) {
    case 'text':
      validateText(node)
      return
    case 'richText':
      validateRichText(node, context)
      return
    case 'repeat':
      return validateRepeat(node, context)
    case 'box':
      if (node.decoration?.length && !node.viewBox)
        fail('装饰必须声明 viewBox')
      return
    case 'shape':
      if (Boolean(node.variants) !== Boolean(node.binding))
        fail('图形映射必须同时声明 binding 和 variants')
      return
    case 'image':
      if (!context.assets.has(node.asset))
        fail(`缺少素材 ${node.asset}`)
      return
    case 'sections':
      if (context.scope !== 'document')
        fail('sections 仅允许在文档配方中使用')
      return
    case 'blocks':
      if (context.scope !== 'section')
        fail('blocks 仅允许在模块配方中使用')
      return
    case 'field':
    case 'meter':
    case 'photo':
      return
    default: {
      const unhandled: never = node
      return unhandled
    }
  }
}
