import type { ExperienceContent } from '@/lib/resume-template/content/types'
import { CommentableRichText } from '@/components/resume/fields/commentable-rich-text'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

function PlainEntry({ item }: { item: ExperienceContent }) {
  const { font, theme, spacing } = useResumeContext()
  const { title, subtitle, duration, description } = item
  if (!title && !subtitle && !duration && !description)
    return null
  return (
    <div className="flex flex-col" style={{ gap: spacing.paragraphSpacing, lineHeight: spacing.lineHeight }}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-wrap items-baseline gap-2 flex-1">
          <h3 className="m-0" style={{ fontSize: font.contentSize, fontWeight: font.boldWeight, color: theme.textPrimary }}>
            {title && <CommentableText nodeKey={title.nodeKey} fieldLabel={title.label} />}
          </h3>
          {subtitle && (
            <span style={{ fontSize: font.contentSize, fontWeight: font.mediumWeight, color: theme.textSecondary }}>
              <CommentableText nodeKey={subtitle.nodeKey} fieldLabel={subtitle.label} />
            </span>
          )}
        </div>
        {duration && (
          <span className="whitespace-nowrap" style={{ fontSize: font.smallSize, color: theme.textMuted }}>
            <CommentableText nodeKey={duration.nodeKey} fieldLabel={duration.label} />
          </span>
        )}
      </div>
      {description && <CommentableRichText nodeKey={description.field.nodeKey} fieldLabel={description.field.label} html={description.html} />}
    </div>
  )
}

export default function PlainEntryList({ items }: { items: ExperienceContent[] }) {
  return <>{items.map(item => <PlainEntry key={item.entryId} item={item} />)}</>
}
