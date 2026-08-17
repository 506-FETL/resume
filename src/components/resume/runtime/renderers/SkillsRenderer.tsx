import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableRichText, CommentableText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function SkillsRenderer() {
  const { skill_specialty, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('skill_specialty')) {
    return null
  }

  return (
    <RuntimeSection title="技能特长" sectionKey="skill_specialty">
      {skill_specialty.description
        ? (
            <CommentableRichText
              nodeKey={buildCommentNodeKey('skill_specialty', 'singleton', 'description')}
              fieldLabel="技能描述"
              html={skill_specialty.description}
            />
          )
        : null}
      {(() => {
        const visibleSkills = skill_specialty.skills.filter(s => !s.hidden)
        return visibleSkills.length > 0
          ? (
              <div className="flex flex-wrap gap-2">
                {visibleSkills.map(skill => (
                  <span
                    key={skill.entryId}
                    className="rounded-full border px-2 py-1"
                    style={{
                      fontSize: font.smallSize,
                      color: theme.textPrimary,
                      borderColor: theme.primaryColor,
                    }}
                  >
                    <CommentableText
                      nodeKey={buildCommentNodeKey('skill_specialty', skill.entryId, 'skill')}
                      fieldLabel="技能"
                    />
                  </span>
                ))}
              </div>
            )
          : null
      })()}
    </RuntimeSection>
  )
}
