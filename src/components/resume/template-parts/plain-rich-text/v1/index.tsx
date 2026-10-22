import type { ContentField } from '@/lib/resume-template/content/types'
import { CommentableRichText } from '@/components/resume/fields/commentable-rich-text'

export default function PlainRichText({ field, html }: { field: ContentField, html: string }) {
  return <CommentableRichText nodeKey={field.nodeKey} fieldLabel={field.label} html={html} />
}
