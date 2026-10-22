import type { SkillContent } from '@/lib/resume-template/content/types'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'
import { PROFICIENCY_PERCENTAGE_MAP } from '@/lib/schema/resume/form/skillSpecialty'

export default function SkillMeters({ items }: { items: SkillContent[] }) {
  const { font, spacing, theme } = useResumeContext()
  return (
    <div className="grid grid-cols-3" style={{ gap: spacing.itemSpacing }}>
      {items.map(item => (
        <div key={item.field.nodeKey} data-pagination-atomic className="min-w-0" style={{ fontSize: font.contentSize, color: theme.textPrimary }}>
          <CommentableText nodeKey={item.field.nodeKey} fieldLabel={item.field.label} />
          <div aria-hidden data-resume-decoration className="mt-1 flex items-center gap-2">
            <span className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: theme.progressBarBg }}>
              <span className="block h-full rounded-full" style={{ width: `${PROFICIENCY_PERCENTAGE_MAP[item.proficiencyLevel]}%`, background: theme.primaryColor }} />
            </span>
            {item.displayType === 'percentage' && (
              <span style={{ color: theme.textMuted, fontSize: font.smallSize }}>
                {PROFICIENCY_PERCENTAGE_MAP[item.proficiencyLevel]}
                %
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
