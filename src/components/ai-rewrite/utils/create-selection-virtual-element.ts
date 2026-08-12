import type { Editor } from '@tiptap/react'
import type { BubbleRect } from './bubble-positioning'
import {
  combineRects,
  getPositionSelectionRects,
} from './bubble-positioning'

function toBubbleRect(rect: DOMRect): BubbleRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function toDOMRect(rect: BubbleRect) {
  return new DOMRect(
    rect.left,
    rect.top,
    rect.width,
    rect.height,
  )
}

export function createSelectionVirtualElement(
  editor: Editor,
  boundary: HTMLElement,
) {
  const { from, to } = editor.state.selection
  if (from === to)
    return null

  try {
    const start = editor.view.domAtPos(from)
    const end = editor.view.domAtPos(to)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)

    const getRawRects = () => Array.from(
      range.getClientRects(),
      toBubbleRect,
    ).filter(rect => rect.width > 0 && rect.height > 0)
    const getPositionRects = () => getPositionSelectionRects(
      getRawRects(),
      toBubbleRect(boundary.getBoundingClientRect()),
    )

    if (getRawRects().length === 0)
      return null

    return {
      contextElement: editor.view.dom,
      getClientRects: () => getPositionRects().map(toDOMRect),
      getBoundingClientRect: () => {
        const combined = combineRects(getPositionRects())
        return combined ? toDOMRect(combined) : new DOMRect()
      },
    }
  }
  catch {
    return null
  }
}
