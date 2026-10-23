import type { AdaptedResumeContent, ContentField } from '../content/types'
import type { RenderScope, TemplateDefinition, TemplateNode } from './types'
import { conditionMatches, resolveField, resolveList } from './bindings'
import { routeTemplateSections } from './page'

type ProfileList = Extract<TemplateNode, { type: 'repeat' }>

function rendersItem(nodes: TemplateNode[]): boolean {
  return nodes.some(node => !node.when && (
    (node.type === 'field' && node.binding === 'item')
    || (node.type === 'box' && rendersItem(node.children))
  ))
}

/** fieldKeys 分配字段位置，不能让新增基本信息在所有区域中静默消失。 */
export function completeProfileFields(definition: TemplateDefinition, content: AdaptedResumeContent): Map<string, ContentField[]> {
  const additions = new Map<string, ContentField[]>()
  const { profile, sections } = content
  if (!profile)
    return additions

  const covered = new Set<string>()
  const lists: Array<{ key: string, node: ProfileList }> = []
  function visit(nodes: TemplateNode[], scope: RenderScope, regionId: string) {
    for (const node of nodes) {
      if (!conditionMatches(node.when, scope))
        continue
      if (node.type === 'field') {
        const field = resolveField(node.binding, scope)
        if (field?.text.trim())
          covered.add(field.nodeKey)
      }
      else if (node.type === 'box') {
        visit(node.children, scope, regionId)
      }
      else if (node.type === 'repeat' && node.source.startsWith('profile.')) {
        if ((node.source === 'profile.meta' || node.source === 'profile.fields') && rendersItem(node.children))
          lists.push({ key: `${regionId}/${node.id}`, node })
        const items = resolveList(node.source, scope, node.fieldOrder, node.fieldKeys)
        items.forEach((item, itemIndex) => visit(node.children, { ...scope, item, itemIndex, itemCount: items.length }, regionId))
      }
    }
  }
  for (const region of definition.page.regions)
    visit(region.document ?? definition.document, { profile, sections: routeTemplateSections(definition, sections, region), region }, region.id)

  const missing = profile.fields.filter(field => field.text.trim() && !covered.has(field.nodeKey))
  // 优先沿用元信息的排版，再使用综合基本信息区；不更改模板原有字段分组。
  const target = lists.find(list => list.node.source === 'profile.meta') ?? lists[0]
  if (target && missing.length)
    additions.set(target.key, missing)
  return additions
}
