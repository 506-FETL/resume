import type {
  RefObject,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import { useCallback } from 'react'
import type { DragSession } from '../types'
import { isInteractiveTarget } from '../geometry'
import { TOUCH_ACTIVATION_DELAY } from '../constants'

export function useDragStart({
  sessionRef,
  suppressClickRef,
  clearPreview,
  activateSession,
}: {
  sessionRef: RefObject<DragSession | null>
  suppressClickRef: RefObject<{ itemId: string; until: number } | null>
  clearPreview: () => void
  activateSession: () => void
}) {
  const beginPointerDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
    ) => {
      if (
        event.pointerType === 'touch' ||
        !event.isPrimary ||
        event.button !== 0 ||
        sessionRef.current
      )
        return
      if (isInteractiveTarget(event.target, event.currentTarget)) return

      clearPreview()
      suppressClickRef.current = null

      const point = { x: event.clientX, y: event.clientY }

      sessionRef.current = {
        kind: 'pointer',
        pointerId: event.pointerId,
        ...item,
        itemElement: event.currentTarget,
        startPoint: point,
        startRect: event.currentTarget.getBoundingClientRect(),
        active: false,
        touchTimer: null,
        destination: null,
      }
    },
    [clearPreview],
  )

  const beginTouchDrag = useCallback(
    (
      event: ReactTouchEvent<HTMLElement>,
      item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
    ) => {
      if (event.touches.length !== 1 || sessionRef.current) return
      if (isInteractiveTarget(event.target, event.currentTarget)) return

      clearPreview()
      suppressClickRef.current = null

      const touch = event.touches[0]

      const session: DragSession = {
        kind: 'touch',
        pointerId: touch.identifier,
        ...item,
        itemElement: event.currentTarget,
        startPoint: { x: touch.clientX, y: touch.clientY },
        startRect: event.currentTarget.getBoundingClientRect(),
        active: false,
        touchTimer: null,
        destination: null,
      }

      session.touchTimer = window.setTimeout(
        activateSession,
        TOUCH_ACTIVATION_DELAY,
      )

      sessionRef.current = session
    },
    [activateSession, clearPreview],
  )

  const suppressClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>, itemId: string) => {
      const suppressed = suppressClickRef.current

      if (
        event.detail === 0 ||
        !suppressed ||
        suppressed.itemId !== itemId ||
        performance.now() > suppressed.until
      )
        return

      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = null
    },
    [],
  )

  return { beginPointerDrag, beginTouchDrag, suppressClick }
}
