import type { ComponentProps } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { useRichTextCollab } from '@/lib/collaboration/richtext/use-rich-text-collab'

interface RichTextFieldEditorProps {
  /** store section key，如 `self_evaluation` / `work_experience` */
  sectionKey: string
  /** 该富文本字段相对 section 的路径，如 `content` / `items.0.workInfo` */
  relativePath: string
  /** 当前 HTML 值（standalone 模式驱动；协作模式仅用于回落） */
  value: string
  /** HTML 变化回调（写回 RHF field.onChange） */
  onChange: (html: string) => void
  /** AI 改写上下文（透传给 SimpleEditor） */
  fieldContext?: ComponentProps<typeof SimpleEditor>['fieldContext']
}

/**
 * 富文本字段编辑器：内部调用 `useRichTextCollab`，据协作状态在
 * standalone / collaborative 之间切换。
 *
 * 独立成组件是为了让数组项（`items.N.*Info`）也能安全使用 hook——
 * 直接在 `fields.map`/`renderItem` 里调 hook 会违反 rules-of-hooks。
 */
export function RichTextFieldEditor({
  sectionKey,
  relativePath,
  value,
  onChange,
  fieldContext,
}: RichTextFieldEditorProps) {
  const collab = useRichTextCollab(sectionKey, relativePath)

  return (
    <SimpleEditor
      content={value || ''}
      onChange={editor => onChange(editor.getHTML())}
      fieldContext={fieldContext}
      collab={collab}
    />
  )
}
