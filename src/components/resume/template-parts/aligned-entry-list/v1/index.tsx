import type { ExperienceContent } from '@/lib/resume-template/content/types'
import { CommentableRichText } from '@/components/resume/fields/commentable-rich-text'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export default function AlignedEntryList({ items }: { items: ExperienceContent[] }) {
  const { font, spacing, theme } = useResumeContext()
  return items.map(item => (
    <div key={item.entryId} className="flex flex-col" style={{ gap: spacing.paragraphSpacing }}>
      <div data-pagination-atomic className="grid items-baseline" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr)', gap: 16, fontSize: font.contentSize, fontWeight: font.boldWeight, color: theme.textPrimary }}>
        <span>{item.duration && <CommentableText nodeKey={item.duration.nodeKey} fieldLabel={item.duration.label} />}</span>
        <h3 className="m-0 text-center" style={{ fontSize: 'inherit', fontWeight: 'inherit', overflowWrap: 'anywhere' }}>{item.title && <CommentableText nodeKey={item.title.nodeKey} fieldLabel={item.title.label} />}</h3>
        <span className="text-right" style={{ overflowWrap: 'anywhere' }}>{item.subtitle && <CommentableText nodeKey={item.subtitle.nodeKey} fieldLabel={item.subtitle.label} />}</span>
      </div>
      {item.description && <CommentableRichText nodeKey={item.description.field.nodeKey} fieldLabel={item.description.field.label} html={item.description.html} />}
    </div>
  ))
}
