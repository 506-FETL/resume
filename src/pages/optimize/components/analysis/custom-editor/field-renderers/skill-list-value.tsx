import type { FieldRendererProps } from './types'
import type { SkillItem } from '@/lib/schema/resume/form/skillSpecialty'
import { isEmptyValue } from '@/pages/optimize/utils'
import { SkillItemValue } from './skill-item-value'
import { EmptyValue } from './types'

export function SkillListValue({ value, variant }: FieldRendererProps<SkillItem[]>) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="flex flex-col gap-1.5">
      {value.map(skill => (
        <SkillItemValue key={`skill-${skill.label}-${skill.proficiencyLevel || 'default'}`} value={skill} variant={variant} />
      ))}
    </div>
  )
}
