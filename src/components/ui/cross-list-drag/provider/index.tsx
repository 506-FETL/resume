import type {
  CrossListDropResult,
  CrossListScrollArea,
  ContainerRegistration,
  DragSession,
  ActiveDrag,
  PreviewSettlement,
  CrossListDragContextValue,
} from '../types'
import type { ReactNode } from 'react'
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useMotionValue, useMotionTemplate, motion } from 'motion/react'
import { useDragDestination } from '../hooks/use-drag-destination'
import { useDragPreview } from '../hooks/use-drag-preview'
import { useDragStart } from '../hooks/use-drag-start'
import { useKeyboardDrag } from '../hooks/use-keyboard-drag'
import { useDragWindowEvents } from '../hooks/use-drag-window-events'
import { CrossListDragContext } from '../context'
import { createPortal } from 'react-dom'

export function CrossListDragProvider({
  onDrop,
  renderOverlay,
  scrollAreas = [],
  children,
}: {
  onDrop: (result: CrossListDropResult) => void | Promise<void>
  renderOverlay: (itemId: string, settling: boolean) => ReactNode
  scrollAreas?: CrossListScrollArea[]
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const containersRef = useRef(new Map<string, ContainerRegistration>())
  const sessionRef = useRef<DragSession | null>(null)
  const scrollAreasRef = useRef(scrollAreas)
  const onDropRef = useRef(onDrop)

  const suppressClickRef = useRef<{ itemId: string; until: number } | null>(
    null,
  )

  const bodyStyleRef = useRef<{ cursor: string; userSelect: string } | null>(
    null,
  )

  const overlayX = useMotionValue(0)
  const overlayY = useMotionValue(0)
  const overlayTransform = useMotionTemplate`translate3d(${overlayX}px, ${overlayY}px, 0)`
  const [active, setActive] = useState<ActiveDrag | null>(null)
  const [liveMessage, setLiveMessage] = useState('')

  useEffect(() => {
    scrollAreasRef.current = scrollAreas
  }, [scrollAreas])

  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const registerContainer = useCallback((container: ContainerRegistration) => {
    containersRef.current.set(container.id, container)

    return () => {
      if (
        containersRef.current.get(container.id)?.element === container.element
      )
        containersRef.current.delete(container.id)
    }
  }, [])

  const restoreBodyStyles = useCallback(() => {
    if (!bodyStyleRef.current) return

    document.body.style.cursor = bodyStyleRef.current.cursor
    document.body.style.userSelect = bodyStyleRef.current.userSelect
    bodyStyleRef.current = null
  }, [])

  const {
    destination,
    setDestination,
    pointRef,
    cancelFrame,
    updateDestination,
    updateDrag,
  } = useDragDestination({
    containersRef,
    sessionRef,
    scrollAreasRef,
    overlayX,
    overlayY,
  })

  const {
    preview,
    setPreview,
    previewElementRef,
    previewAnimationRef,
    settlementRef,
    clearPreview,
    settlePreview,
  } = useDragPreview({
    containersRef,
    sessionRef,
    overlayX,
    overlayY,
    active,
    children,
    reduceMotion,
  })

  const clearSession = useCallback(
    (updateState = true, pendingDrop?: void | Promise<void>) => {
      const session = sessionRef.current

      if (session?.touchTimer != null) window.clearTimeout(session.touchTimer)
      if (
        session?.kind === 'pointer' &&
        session.itemElement.hasPointerCapture(session.pointerId)
      )
        session.itemElement.releasePointerCapture(session.pointerId)

      if (session?.active && session.kind !== 'keyboard') {
        suppressClickRef.current = {
          itemId: session.itemId,
          until: performance.now() + 350,
        }
      }

      sessionRef.current = null
      pointRef.current = null
      cancelFrame()
      restoreBodyStyles()

      if (updateState) {
        if (session?.active && session.kind !== 'keyboard') {
          const settlement: PreviewSettlement = {
            session,
            pendingDrop: Boolean(pendingDrop),
            targetTransform: null,
          }

          settlementRef.current = settlement

          if (pendingDrop) {
            const finishDrop = () => {
              if (settlementRef.current !== settlement) return

              settlement.pendingDrop = false
              settlePreview()
            }

            pendingDrop.then(finishDrop, finishDrop)
          }
        }

        setActive(null)
        setDestination(null)
      } else {
        settlementRef.current = null
        previewAnimationRef.current?.cancel()
        previewAnimationRef.current = null
      }
    },
    [cancelFrame, restoreBodyStyles, settlePreview],
  )

  const activateSession = useCallback(() => {
    const session = sessionRef.current

    if (!session || session.active) return

    clearPreview()
    session.active = true
    session.touchTimer = null

    if (
      session.kind === 'pointer' &&
      !session.itemElement.hasPointerCapture(session.pointerId)
    )
      session.itemElement.setPointerCapture(session.pointerId)

    session.startRect = session.itemElement.getBoundingClientRect()
    overlayX.set(0)
    overlayY.set(0)

    bodyStyleRef.current = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const nextActive = {
      kind: session.kind,
      itemId: session.itemId,
      sourceId: session.sourceId,
      sourceIndex: session.sourceIndex,
      startRect: session.startRect,
    }

    setActive(nextActive)
    setPreview(nextActive)
    updateDrag(session.startPoint)
  }, [clearPreview, overlayX, overlayY, updateDrag])

  const finishSession = useCallback(() => {
    const session = sessionRef.current

    if (!session) {
      return
    }

    const destinationIsValid =
      session.destination !== null &&
      containersRef.current.has(session.destination.containerId)

    const result =
      session.active && session.destination && destinationIsValid
        ? {
            itemId: session.itemId,
            sourceId: session.sourceId,
            sourceIndex: session.sourceIndex,
            destinationId: session.destination.containerId,
            destinationIndex: session.destination.index,
          }
        : null

    const pendingDrop = result ? onDropRef.current(result) : undefined

    clearSession(true, pendingDrop)
  }, [clearSession])

  const { beginPointerDrag, beginTouchDrag, suppressClick } = useDragStart({
    sessionRef,
    suppressClickRef,
    clearPreview,
    activateSession,
  })

  const { handleKeyboardDrag } = useKeyboardDrag({
    containersRef,
    sessionRef,
    active,
    setActive,
    setDestination,
    setLiveMessage,
    clearPreview,
    clearSession,
    finishSession,
  })

  useEffect(() => {
    const session = sessionRef.current

    if (!session) return

    const source = containersRef.current.get(session.sourceId)

    const target = session.destination
      ? containersRef.current.get(session.destination.containerId)
      : null

    if (
      !session.itemElement.isConnected ||
      !source?.itemIds.includes(session.itemId) ||
      (session.destination !== null && !target)
    ) {
      clearSession()
      setLiveMessage('拖动项目已变化，已取消拖动')
    }
  }, [active, children, clearSession, destination])

  useDragWindowEvents({
    sessionRef,
    overlayX,
    overlayY,
    setLiveMessage,
    activateSession,
    updateDrag,
    updateDestination,
    finishSession,
    clearSession,
  })

  const context = useMemo<CrossListDragContextValue>(
    () => ({
      active,
      preview,
      destination,
      registerContainer,
      beginPointerDrag,
      beginTouchDrag,
      handleKeyboardDrag,
      suppressClick,
    }),
    [
      active,
      preview,
      beginPointerDrag,
      beginTouchDrag,
      destination,
      handleKeyboardDrag,
      registerContainer,
      suppressClick,
    ],
  )

  return (
    <CrossListDragContext value={context}>
      {children}
      <div aria-atomic='true' aria-live='polite' className='sr-only'>
        {liveMessage}
      </div>
      {preview &&
        typeof document !== 'undefined' &&
        createPortal(
          <motion.div
            ref={previewElementRef}
            aria-hidden='true'
            data-motion-drag-preview=''
            style={{
              position: 'fixed',
              left: preview.startRect.left,
              top: preview.startRect.top,
              width: preview.startRect.width,
              minHeight: preview.startRect.height,
              transform: overlayTransform,
              transformOrigin: 'top left',
              opacity: 1,
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            {renderOverlay(preview.itemId, active === null)}
          </motion.div>,
          document.body,
        )}
    </CrossListDragContext>
  )
}
