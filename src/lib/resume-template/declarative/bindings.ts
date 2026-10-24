import type { ContentField } from '../content/types'
import type {
  Binding,
  FieldBinding,
  ListBinding,
  RenderScope,
  RichTextBinding,
  TemplateCondition,
  TemplateNode,
} from './types'
import {
  bindingRegistry,
  fieldBindings,
  isContentField,
  listBindings,
  richTextBindings,
} from './binding-registry'

export { isContentField } from './binding-registry'

export function resolveField(
  binding: FieldBinding,
  scope: RenderScope,
): ContentField | undefined {
  return fieldBindings[binding].read(scope)
}
export function resolveRichText(
  binding: RichTextBinding,
  scope: RenderScope,
): { field: ContentField; html: string } | undefined {
  return richTextBindings[binding].read(scope)
}
export function resolveList(
  binding: ListBinding,
  scope: RenderScope,
  fieldOrder?: string[],
  fieldKeys?: string[],
): NonNullable<RenderScope['item']>[] {
  const values = listBindings[binding].read(scope)
  const visible = values.filter((item) => {
    if (
      fieldKeys &&
      (!isContentField(item) || !fieldKeys.includes(item.fieldKey))
    )
      return false
    if (isContentField(item)) return item.text.trim().length > 0
    if ('field' in item) return item.field.text.trim().length > 0
    return [
      item.title?.text,
      item.subtitle?.text,
      item.duration?.text,
      item.description?.field.text,
    ].some((value) => value?.trim())
  })
  if (!fieldOrder?.length) return visible
  const rank = (item: NonNullable<RenderScope['item']>) =>
    isContentField(item) ? fieldOrder.indexOf(item.fieldKey) : -1
  return [...visible].sort(
    (a, b) =>
      (rank(a) < 0 ? fieldOrder.length : rank(a)) -
      (rank(b) < 0 ? fieldOrder.length : rank(b)),
  )
}
export function resolveBinding(binding: Binding, scope: RenderScope): unknown {
  if (Object.hasOwn(listBindings, binding))
    return resolveList(binding as ListBinding, scope)
  return bindingRegistry[binding].read(scope)
}
export function resolveText(
  node: Extract<TemplateNode, { type: 'text' }>,
  scope: RenderScope,
): string {
  const value = node.text ?? String(resolveBinding(node.binding!, scope) ?? '')
  if (!value) return ''
  const mapped =
    node.map && Object.hasOwn(node.map, value) ? node.map[value] : value
  return node.format === 'pad2' ? mapped.padStart(2, '0') : mapped
}
export function conditionMatches(
  condition: TemplateCondition | undefined,
  scope: RenderScope,
): boolean {
  if (!condition) return true
  const value = resolveBinding(condition.binding, scope)
  if (condition.operator === 'equals') return String(value) === condition.value
  if (isContentField(value)) return Boolean(value.text.trim())
  if (Array.isArray(value)) return value.length > 0
  if (
    value &&
    typeof value === 'object' &&
    'field' in value &&
    isContentField(value.field)
  )
    return Boolean(value.field.text.trim())
  return (
    value !== undefined && value !== null && value !== '' && value !== false
  )
}
export function itemIdentity(item: NonNullable<RenderScope['item']>): string {
  return isContentField(item)
    ? item.nodeKey
    : 'field' in item
      ? item.field.nodeKey
      : item.entryId
}
