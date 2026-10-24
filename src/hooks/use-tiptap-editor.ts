import type { Editor } from '@tiptap/react'
import { useCurrentEditor, useEditorState } from '@tiptap/react'
import * as React from 'react'

/**
 * 统一获取可用的 Tiptap 编辑器实例及其派生状态。
 *
 * Hook 优先使用显式传入的 `providedEditor`；
 * 如果没有提供，则退回到当前 Tiptap 上下文中的编辑器实例。
 * 这样同一个组件既可以在外部直接传 editor 时工作，
 * 也可以在 `EditorProvider` 上下文内部自动取到 editor。
 *
 * 同时，Hook 还会借助 `useEditorState` 返回当前 editor 的状态对象和
 * `can` 命令能力，方便调用方在不重复订阅的前提下读取编辑器状态。
 *
 * @param providedEditor 可选的编辑器实例；传入后会覆盖上下文中的 editor
 * @returns 包含 editor、editorState 和 canCommand 的对象；当编辑器不存在时返回 `{ editor: null }`
 */
export function useTiptapEditor(providedEditor?: Editor | null): {
  editor: Editor | null
  editorState?: Editor['state']
  canCommand?: Editor['can']
} {
  const { editor: coreEditor } = useCurrentEditor()

  const mainEditor = React.useMemo(
    () => providedEditor || coreEditor,
    [providedEditor, coreEditor],
  )

  const editorState = useEditorState({
    editor: mainEditor,
    selector(context) {
      if (!context.editor) {
        return {
          editor: null,
          editorState: undefined,
          canCommand: undefined,
        }
      }

      return {
        editor: context.editor,
        editorState: context.editor.state,
        canCommand: context.editor.can,
      }
    },
  })

  return editorState || { editor: null }
}
