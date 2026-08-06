import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { RuntimeRichText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function SkillsRenderer() {
  const { skill_specialty, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('skill_specialty')) {
    return null
  }

  return (
    <RuntimeSection title="技能特长">
      {skill_specialty.description ? <RuntimeRichText html={skill_specialty.description} /> : null}
      {skill_specialty.skills.length > 0
        ? (
            <div className="flex flex-wrap gap-2">
              {skill_specialty.skills.map((skill, index) => (
                <span
                  // 空/重复技能项无稳定唯一内容，用 index 保证 key 唯一（避免 undefined-undefined 重复 key）
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${skill.label}-${skill.proficiencyLevel}-${index}`}
                  className="rounded-full border px-2 py-1"
                  style={{
                    fontSize: font.smallSize,
                    color: theme.textPrimary,
                    borderColor: theme.primaryColor,
                  }}
                >
                  {skill.label}
                  {' '}
                  ·
                  {' '}
                  {skill.proficiencyLevel}
                </span>
              ))}
            </div>
          )
        : null}
    </RuntimeSection>
  )
}
