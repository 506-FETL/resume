import type { Editor } from '@tiptap/react'
import type { RewriteSelection } from './types'
import { DOMSerializer } from '@tiptap/pm/model'
import { useCallback } from 'react'
import { SELECTION_MIN_CHARS } from './const'

export function useRewriteSelection(editor: Editor) {
  return useCallback((): RewriteSelection | null => {
    const { from, to } = editor.state.selection
    if (from === to)
      return null

    const text = editor.state.doc.textBetween(from, to, '\n').trim()
    if (text.length < SELECTION_MIN_CHARS)
      return null

    const slice = editor.state.doc.slice(from, to)
    const div = document.createElement('div')
    const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content)
    div.appendChild(fragment)

    return { from, to, text, html: div.innerHTML }
  }, [editor])
}
