import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableRichText, CommentableText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function HobbiesRenderer() {
  const { hobbies, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('hobbies')) {
    return null
  }

  return (
    <RuntimeSection title="兴趣爱好" sectionKey="hobbies">
      {hobbies.description
        ? (
            <CommentableRichText
              nodeKey={buildCommentNodeKey('hobbies', 'singleton', 'description')}
              fieldLabel="兴趣爱好描述"
              html={hobbies.description}
            />
          )
        : null}
      {(() => {
        const visibleHobbies = hobbies.hobbies.filter(item => !item.hidden)
        return visibleHobbies.length > 0
          ? (
              <div className="flex flex-wrap gap-2">
                {visibleHobbies.map(item => (
                  <span
                    key={item.entryId}
                    className="rounded-full border px-2 py-1"
                    style={{
                      fontSize: font.smallSize,
                      color: theme.textPrimary,
                      borderColor: theme.primaryColor,
                    }}
                  >
                    <CommentableText
                      nodeKey={buildCommentNodeKey('hobbies', item.entryId, 'name')}
                      fieldLabel="兴趣爱好"
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
