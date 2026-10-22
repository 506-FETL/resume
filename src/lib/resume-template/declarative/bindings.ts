import type { ContentField, ExperienceContent, SkillContent } from '../content/types'
import type { Binding, FieldBinding, ListBinding, RenderScope, RichTextBinding, TemplateCondition } from './types'
import { PROFICIENCY_PERCENTAGE_MAP } from '@/lib/schema/resume/form/skillSpecialty'

export function isContentField(value: unknown): value is ContentField {
  return Boolean(value && typeof value === 'object' && 'nodeKey' in value && 'fieldKey' in value)
}
export function resolveField(binding: FieldBinding, scope: RenderScope): ContentField | undefined {
  switch (binding) {
    case 'profile.name': return scope.profile?.name
    case 'profile.workYears': return scope.profile?.workYears
    case 'item': return isContentField(scope.item) ? scope.item : undefined
    case 'item.field': return scope.item && 'field' in scope.item ? scope.item.field : undefined
    case 'item.title': return (scope.item as ExperienceContent | undefined)?.title
    case 'item.subtitle': return (scope.item as ExperienceContent | undefined)?.subtitle
    case 'item.duration': return (scope.item as ExperienceContent | undefined)?.duration
  }
}
export function resolveRichText(binding: RichTextBinding, scope: RenderScope): { field: ContentField, html: string } | undefined {
  if (binding === 'block.richText')
    return scope.block?.kind === 'richText' ? scope.block : undefined
  return (scope.item as ExperienceContent | undefined)?.description
}
export function resolveList(binding: ListBinding, scope: RenderScope, fieldOrder?: string[]): NonNullable<RenderScope['item']>[] {
  const values = binding === 'block.items'
    ? scope.block && 'items' in scope.block ? scope.block.items : []
    : binding === 'profile.fields'
      ? scope.profile?.fields ?? []
      : binding === 'profile.jobIntent'
        ? scope.profile?.jobIntent ?? []
        : binding === 'profile.meta' ? scope.profile?.meta ?? [] : scope.profile?.contact ?? []
  const visible = values.filter((item) => {
    if (isContentField(item))
      return item.text.trim().length > 0
    if ('field' in item)
      return item.field.text.trim().length > 0
    return [item.title?.text, item.subtitle?.text, item.duration?.text, item.description?.field.text].some(value => value?.trim())
  })
  if (!fieldOrder?.length)
    return visible
  const rank = (item: NonNullable<RenderScope['item']>) => isContentField(item) ? fieldOrder.indexOf(item.fieldKey) : -1
  return [...visible].sort((a, b) => (rank(a) < 0 ? fieldOrder.length : rank(a)) - (rank(b) < 0 ? fieldOrder.length : rank(b)))
}
export function resolveBinding(binding: Binding, scope: RenderScope): unknown {
  if (binding === 'profile')
    return scope.profile
  if (binding === 'sections')
    return scope.sections
  if (binding === 'section.title')
    return scope.section?.title
  if ((binding.startsWith('profile.') && !['profile.name', 'profile.workYears'].includes(binding)) || binding === 'block.items')
    return resolveList(binding as ListBinding, scope)
  if (binding === 'item.label')
    return isContentField(scope.item) ? scope.item.label : scope.item && 'field' in scope.item ? scope.item.field.label : undefined
  if (binding === 'item.percentage')
    return scope.item && 'proficiencyLevel' in scope.item ? PROFICIENCY_PERCENTAGE_MAP[scope.item.proficiencyLevel] : undefined
  if (binding === 'item.proficiency')
    return (scope.item as SkillContent | undefined)?.proficiencyLevel
  if (binding === 'item.displayType')
    return (scope.item as SkillContent | undefined)?.displayType
  if (binding === 'block.richText' || binding === 'item.description')
    return resolveRichText(binding, scope)
  return resolveField(binding as FieldBinding, scope)
}
export function conditionMatches(condition: TemplateCondition | undefined, scope: RenderScope): boolean {
  if (!condition)
    return true
  const value = resolveBinding(condition.binding, scope)
  if (condition.operator === 'equals')
    return String(value) === condition.value
  if (isContentField(value))
    return Boolean(value.text.trim())
  if (Array.isArray(value))
    return value.length > 0
  if (value && typeof value === 'object' && 'field' in value && isContentField(value.field))
    return Boolean(value.field.text.trim())
  return value !== undefined && value !== null && value !== '' && value !== false
}
export function itemIdentity(item: NonNullable<RenderScope['item']>): string {
  return isContentField(item) ? item.nodeKey : 'field' in item ? item.field.nodeKey : item.entryId
}
