import type { ContentField } from '../content/types'
import type {
  Binding,
  ContentKind,
  FieldBinding,
  ListBinding,
  RenderScope,
  RichTextBinding,
} from './types'
import { PROFICIENCY_PERCENTAGE_MAP } from '@/lib/schema/resume/form/skillSpecialty'

export type BindingScope =
  | 'document'
  | 'section'
  | ContentKind
  | 'profile-fields'
  | 'experience-item'
  | 'skills-item'
  | 'field-item'
type AllowedScopes = 'any' | 'section' | readonly BindingScope[]
interface BindingDescriptor<T> {
  scopes: AllowedScopes
  read: (scope: RenderScope) => T
}

function binding<T>(
  scopes: AllowedScopes,
  read: (scope: RenderScope) => T,
): BindingDescriptor<T> {
  return { scopes, read }
}

export function isContentField(value: unknown): value is ContentField {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'nodeKey' in value &&
    'fieldKey' in value,
  )
}

function itemField({ item }: RenderScope): ContentField | undefined {
  return isContentField(item)
    ? item
    : item && 'field' in item
      ? item.field
      : undefined
}

const itemScopes = [
  'profile-fields',
  'experience-item',
  'skills-item',
  'field-item',
] as const
const fieldScopes = ['profile-fields', 'skills-item', 'field-item'] as const

export const fieldBindings = {
  'profile.name': binding('any', (scope) => scope.profile?.name),
  'profile.workYears': binding('any', (scope) => scope.profile?.workYears),
  item: binding(['field-item', 'profile-fields'], (scope) =>
    isContentField(scope.item) ? scope.item : undefined,
  ),
  'item.field': binding(['skills-item'], (scope) =>
    scope.item && 'field' in scope.item ? scope.item.field : undefined,
  ),
  'item.title': binding(['experience-item'], (scope) =>
    scope.item && 'title' in scope.item ? scope.item.title : undefined,
  ),
  'item.subtitle': binding(['experience-item'], (scope) =>
    scope.item && 'subtitle' in scope.item ? scope.item.subtitle : undefined,
  ),
  'item.duration': binding(['experience-item'], (scope) =>
    scope.item && 'duration' in scope.item ? scope.item.duration : undefined,
  ),
} satisfies Record<FieldBinding, BindingDescriptor<ContentField | undefined>>

export const richTextBindings = {
  'block.richText': binding(['richText'], (scope) =>
    scope.block?.kind === 'richText' ? scope.block : undefined,
  ),
  'item.description': binding(['experience-item'], (scope) =>
    scope.item && 'description' in scope.item
      ? scope.item.description
      : undefined,
  ),
} satisfies Record<
  RichTextBinding,
  BindingDescriptor<{ field: ContentField; html: string } | undefined>
>

export const listBindings = {
  'profile.fields': binding('any', (scope) => scope.profile?.fields ?? []),
  'profile.jobIntent': binding(
    'any',
    (scope) => scope.profile?.jobIntent ?? [],
  ),
  'profile.meta': binding('any', (scope) => scope.profile?.meta ?? []),
  'profile.contact': binding('any', (scope) => scope.profile?.contact ?? []),
  'block.items': binding(
    ['experience', 'skills', 'fieldList', 'tagList'],
    (scope) => (scope.block && 'items' in scope.block ? scope.block.items : []),
  ),
} satisfies Record<
  ListBinding,
  BindingDescriptor<NonNullable<RenderScope['item']>[]>
>

/** 绑定的读取方法与作用域在同一处声明，校验器和解释器共同使用。 */
export const bindingRegistry = {
  ...fieldBindings,
  ...richTextBindings,
  ...listBindings,
  'profile.photo': binding('any', (scope) => scope.profile?.photo),
  profile: binding('any', (scope) => scope.profile),
  sections: binding('any', (scope) => scope.sections),
  'section.key': binding('section', (scope) => scope.section?.key),
  'section.title': binding('section', (scope) => scope.section?.title),
  'section.index': binding('section', (scope) =>
    scope.sectionIndex === undefined ? undefined : scope.sectionIndex + 1,
  ),
  'item.index': binding(itemScopes, (scope) =>
    scope.itemIndex === undefined ? undefined : scope.itemIndex + 1,
  ),
  'item.parity': binding(itemScopes, (scope) =>
    scope.itemIndex === undefined
      ? undefined
      : scope.itemIndex % 2 === 0
        ? 'odd'
        : 'even',
  ),
  'item.first': binding(itemScopes, (scope) => scope.itemIndex === 0),
  'item.last': binding(
    itemScopes,
    (scope) =>
      scope.itemIndex !== undefined &&
      scope.itemIndex === (scope.itemCount ?? 0) - 1,
  ),
  'item.fieldKey': binding(fieldScopes, (scope) => itemField(scope)?.fieldKey),
  'item.label': binding(fieldScopes, (scope) => itemField(scope)?.label),
  'item.percentage': binding(['skills-item'], (scope) =>
    scope.item && 'proficiencyLevel' in scope.item
      ? PROFICIENCY_PERCENTAGE_MAP[scope.item.proficiencyLevel]
      : undefined,
  ),
  'item.proficiency': binding(['skills-item'], (scope) =>
    scope.item && 'proficiencyLevel' in scope.item
      ? scope.item.proficiencyLevel
      : undefined,
  ),
  'item.displayType': binding(['skills-item'], (scope) =>
    scope.item && 'displayType' in scope.item
      ? scope.item.displayType
      : undefined,
  ),
} satisfies Record<Binding, BindingDescriptor<unknown>>

export function isBindingAllowed(
  binding: Binding,
  scope: BindingScope,
  hasSection: boolean,
): boolean {
  const { scopes } = bindingRegistry[binding]
  return (
    scopes === 'any' ||
    (scopes === 'section' ? hasSection : scopes.includes(scope))
  )
}
