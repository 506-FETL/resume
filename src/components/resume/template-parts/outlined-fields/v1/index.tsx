import type { ContentField } from '@/lib/resume-template/content/types'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export default function OutlinedFields({ items, keepEmpty = false }: { items: ContentField[], keepEmpty?: boolean }) {
  const { font, theme } = useResumeContext()
  if (!keepEmpty && items.length === 0)
    return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(field => (
        <span key={field.nodeKey} className="rounded-full border px-2 py-1" style={{ fontSize: font.smallSize, color: theme.textPrimary, borderColor: theme.primaryColor }}>
          <CommentableText nodeKey={field.nodeKey} fieldLabel={field.label} />
        </span>
      ))}
    </div>
  )
}
