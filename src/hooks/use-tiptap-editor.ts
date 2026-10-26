import type { Editor } from '@tiptap/react'
import { useCurrentEditor } from '@tiptap/react'

/** 只获取实例；按钮在各自 hook 中订阅所需状态，避免每个字符重绘整条工具栏。 */
export function useTiptapEditor(providedEditor?: Editor | null): {
  editor: Editor | null
} {
  const { editor } = useCurrentEditor()

  return { editor: providedEditor || editor }
}
