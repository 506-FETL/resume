import type { ComponentType } from 'react'
import type { RendererVariant } from './types'
import { CertificateListValue } from './certificate-list-value'
import { DateRangeValue } from './date-range-value'
import { ObjectArrayValue } from './object-array-value'
import { ObjectValue } from './object-value'
import { SkillItemValue } from './skill-item-value'
import { SkillListValue } from './skill-list-value'
import { StringArrayValue } from './string-array-value'

export const RENDERER_MAP: Record<
  string,
  ComponentType<{ value: any; variant?: RendererVariant }>
> = {
  date_range: DateRangeValue,
  skill_list: SkillListValue,
  skill_item: SkillItemValue,
  certificate_list: CertificateListValue,
  string_array: StringArrayValue,
  object_array: ObjectArrayValue,
  object: ObjectValue,
}

export { HtmlStringValue } from './html-string-value'

export { StringValue } from './string-value'

export { EmptyValue } from './types'

export type { RendererVariant } from './types'
