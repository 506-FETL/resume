import type { CrossListDragItemProps } from '../types'
import { useCrossListDragContext } from '../context'
import { useCallback } from 'react'

export function useCrossListItem({
  id,
  containerId,
  index,
}: {
  id: string
  containerId: string
  index: number
}): {
  dragging: boolean
  previewing: boolean
  settling: boolean
  getDragProps: () => CrossListDragItemProps
} {
  const context = useCrossListDragContext()

  const {
    active,
    preview,
    beginPointerDrag,
    beginTouchDrag,
    handleKeyboardDrag,
    suppressClick,
  } = context

  const getDragProps = useCallback(
    (): CrossListDragItemProps => ({
      'data-motion-drag-item': id,
      'data-motion-drag-container-id': containerId,
      role: 'listitem',
      tabIndex: 0,
      'aria-roledescription': '可拖动项目',
      'aria-keyshortcuts':
        'Space Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape',
      onPointerDown: (event) =>
        beginPointerDrag(event, {
          itemId: id,
          sourceId: containerId,
          sourceIndex: index,
        }),
      onTouchStart: (event) =>
        beginTouchDrag(event, {
          itemId: id,
          sourceId: containerId,
          sourceIndex: index,
        }),
      onKeyDown: (event) =>
        handleKeyboardDrag(event, {
          itemId: id,
          sourceId: containerId,
          sourceIndex: index,
        }),
      onClickCapture: (event) => suppressClick(event, id),
    }),
    [
      beginPointerDrag,
      beginTouchDrag,
      containerId,
      handleKeyboardDrag,
      id,
      index,
      suppressClick,
    ],
  )

  return {
    dragging: active?.itemId === id,
    previewing: preview?.itemId === id,
    settling: preview?.itemId === id && active === null,
    getDragProps,
  }
}
