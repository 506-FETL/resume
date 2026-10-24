import type { BindingScope } from './binding-registry'
import type { ContentKind, TemplateDefinition, TemplateNode } from './types'
import { DEFAULT_ORDER } from '@/lib/schema'
import { validateCommonNode, validateSpecificNode } from './node-validation'
import {
  fail,
  SUPPORTED_TEMPLATE_CAPABILITIES,
  TEMPLATE_LIMITS,
  TemplateValidationError,
} from './validation-context'

export {
  SUPPORTED_TEMPLATE_CAPABILITIES,
  TEMPLATE_LIMITS,
  TemplateValidationError,
} from './validation-context'

export function validateTemplateDefinition(
  definition: TemplateDefinition,
): void {
  if (
    new TextEncoder().encode(JSON.stringify(definition)).byteLength >
    TEMPLATE_LIMITS.definitionBytes
  )
    throw new TemplateValidationError('limit', '模板定义超过大小预算')
  if (
    definition.capabilities.some(
      (capability) =>
        !(SUPPORTED_TEMPLATE_CAPABILITIES as readonly string[]).includes(
          capability,
        ),
    )
  )
    throw new TemplateValidationError('capability', '模板要求尚未支持的能力')
  const regionIds = new Set<string>()
  const sectionKeys = new Set<string>()
  if (
    definition.page.regions.filter((region) => region.sections === 'remaining')
      .length !== 1
  )
    fail('页面必须恰好有一个 remaining 区域')
  definition.page.regions.forEach((region) => {
    if (regionIds.has(region.id)) fail(`重复区域 ${region.id}`)
    regionIds.add(region.id)
    if (region.sections !== 'remaining') {
      for (const key of region.sections) {
        if (
          !(DEFAULT_ORDER as readonly string[]).includes(key) ||
          key === 'basics' ||
          key === 'job_intent'
        )
          fail(`无法路由的模块键 ${key}`)
        if (sectionKeys.has(key)) fail(`重复路由模块 ${key}`)
        sectionKeys.add(key)
      }
    }
  })
  const countSections = (nodes: TemplateNode[]): number =>
    nodes.reduce(
      (count, node) =>
        count +
        (node.type === 'sections'
          ? 1
          : 'children' in node
            ? countSections(node.children)
            : 0),
      0,
    )
  if (
    definition.page.regions.some(
      (region) => countSections(region.document ?? definition.document) > 1,
    )
  )
    fail('每个区域的模块集合只能消费一次')
  // 按有效文档累计，继承相同默认配方也会实际渲染两次；条件不视作互斥证明。
  const countProfileTargets = (nodes: TemplateNode[]): number =>
    nodes.reduce(
      (count, node) =>
        count +
        (node.sectionTarget === 'basics' ? 1 : 0) +
        ('children' in node ? countProfileTargets(node.children) : 0),
      0,
    )
  const effectiveProfileTargets = definition.page.regions.reduce(
    (count, region) =>
      count + countProfileTargets(region.document ?? definition.document),
    0,
  )
  if (effectiveProfileTargets > 1)
    fail('个人信息定位标记在所有有效区域中只能出现一次')
  if (
    definition.page.pattern &&
    definition.page.pattern.radius * 2 > definition.page.pattern.spacing
  )
    fail('点阵半径不能超过间距的一半')
  if (
    definition.page.pattern &&
    Math.ceil(794 / definition.page.pattern.spacing) *
      Math.ceil(1123 / definition.page.pattern.spacing) >
      TEMPLATE_LIMITS.renderedNodes
  )
    throw new TemplateValidationError('limit', '点阵重复超过渲染预算')
  const assets = new Set<string>()
  definition.assets.forEach((asset) => {
    if (assets.has(asset.id)) fail(`重复素材 ${asset.id}`)
    assets.add(asset.id)
  })
  let count = 0
  let profileTargets = 0
  const ids = new Set<string>()
  const walk = (
    nodes: TemplateNode[],
    scope: BindingScope,
    depth: number,
    hasSection: boolean,
  ) => {
    if (depth > TEMPLATE_LIMITS.depth)
      throw new TemplateValidationError('limit', '模板嵌套超过深度预算')
    for (const node of nodes) {
      if (++count > TEMPLATE_LIMITS.nodes)
        throw new TemplateValidationError('limit', '模板节点超过数量预算')
      if (ids.has(node.id)) fail(`重复布局节点 ${node.id}`)
      ids.add(node.id)
      if (node.sectionTarget) {
        if (scope !== 'document' || node.type !== 'box' || ++profileTargets > 1)
          fail('个人信息定位标记仅允许出现在唯一的文档容器中')
      }
      const context = { definition, assets, scope, hasSection }
      validateCommonNode(node, context)
      const childScope = validateSpecificNode(node, context)
      if ('children' in node)
        walk(node.children, childScope ?? scope, depth + 1, hasSection)
    }
  }
  walk(definition.document, 'document', 1, false)
  walk(definition.section, 'section', 1, true)
  Object.entries(definition.contentByKind).forEach(([kind, nodes]) =>
    walk(nodes, kind as ContentKind, 1, true),
  )
  for (const region of definition.page.regions) {
    // 覆盖配方属于独立命名域；总预算仍跨全部配方累计。
    ids.clear()
    profileTargets = 0
    if (region.document) walk(region.document, 'document', 1, false)
    if (region.section) walk(region.section, 'section', 1, true)
    Object.entries(region.contentByKind ?? {}).forEach(([kind, nodes]) =>
      walk(nodes, kind as ContentKind, 1, true),
    )
  }
}
