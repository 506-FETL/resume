import type { RefObject, Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import type { DragSession } from '../types'
import type { MotionValue } from 'motion/react'
import type { DragPoint } from '@/lib/motion-drag'
import { distanceBetween } from '../geometry'
import {
  DRAG_ACTIVATION_DISTANCE,
  TOUCH_ACTIVATION_TOLERANCE,
} from '../constants'

export function useDragWindowEvents({
  sessionRef,
  overlayX,
  overlayY,
  setLiveMessage,
  activateSession,
  updateDrag,
  updateDestination,
  finishSession,
  clearSession,
}: {
  sessionRef: RefObject<DragSession | null>
  overlayX: MotionValue<number>
  overlayY: MotionValue<number>
  setLiveMessage: Dispatch<SetStateAction<string>>
  activateSession: () => void
  updateDrag: (point: DragPoint) => void
  updateDestination: (point: DragPoint) => void
  finishSession: () => void
  clearSession: (
    updateState?: boolean,
    pendingDrop?: void | Promise<void>,
  ) => void
}) {
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = sessionRef.current

      if (
        !session ||
        session.kind !== 'pointer' ||
        session.pointerId !== event.pointerId
      )
        return

      const point = { x: event.clientX, y: event.clientY }

      if (
        !session.active &&
        distanceBetween(session.startPoint, point) >= DRAG_ACTIVATION_DISTANCE
      )
        activateSession()
      if (!session.active) return
      if (event.cancelable) event.preventDefault()

      updateDrag(point)
    }

    const handlePointerUp = (event: PointerEvent) => {
      const session = sessionRef.current

      if (
        session?.kind === 'pointer' &&
        session.pointerId === event.pointerId
      ) {
        if (session.active) {
          const point = { x: event.clientX, y: event.clientY }

          overlayX.set(point.x - session.startPoint.x)
          overlayY.set(point.y - session.startPoint.y)
          updateDestination(point)
        }

        finishSession()
      }
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const session = sessionRef.current

      if (session?.kind === 'pointer' && session.pointerId === event.pointerId)
        clearSession()
    }

    const handleTouchMove = (event: TouchEvent) => {
      const session = sessionRef.current

      if (!session || session.kind !== 'touch') return

      const touch = [...event.touches].find(
        (item) => item.identifier === session.pointerId,
      )

      if (!touch) return

      const point = { x: touch.clientX, y: touch.clientY }

      if (
        !session.active &&
        distanceBetween(session.startPoint, point) > TOUCH_ACTIVATION_TOLERANCE
      ) {
        clearSession()

        return
      }
      if (!session.active) return
      if (event.cancelable) event.preventDefault()

      updateDrag(point)
    }

    const handleTouchEnd = (event: TouchEvent) => {
      const session = sessionRef.current

      if (!session || session.kind !== 'touch') return

      const touch = [...event.changedTouches].find(
        (item) => item.identifier === session.pointerId,
      )

      if (!touch) return
      if (session.active) {
        const point = { x: touch.clientX, y: touch.clientY }

        overlayX.set(point.x - session.startPoint.x)
        overlayY.set(point.y - session.startPoint.y)
        updateDestination(point)
      }

      finishSession()
    }

    const handleTouchCancel = (event: TouchEvent) => {
      const session = sessionRef.current

      if (!session || session.kind !== 'touch') return
      if (
        [...event.changedTouches].some(
          (item) => item.identifier === session.pointerId,
        )
      )
        clearSession()
    }

    const handleBlur = () => clearSession()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !sessionRef.current) return

      event.preventDefault()
      event.stopPropagation()
      clearSession()
      setLiveMessage('已取消拖动')
    }

    window.addEventListener('pointermove', handlePointerMove, {
      passive: false,
    })

    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchCancel)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleEscape, true)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleEscape, true)
      clearSession(false)
    }
  }, [
    activateSession,
    clearSession,
    finishSession,
    overlayX,
    overlayY,
    updateDestination,
    updateDrag,
  ])
}
