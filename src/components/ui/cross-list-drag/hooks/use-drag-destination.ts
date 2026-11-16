import type { RefObject } from 'react'
import { useRef, useState, useCallback } from 'react'
import type {
  ContainerRegistration,
  DragSession,
  CrossListScrollArea,
} from '../types'
import type { MotionValue } from 'motion/react'
import type { DragPoint, DropDestination, DragAxis } from '@/lib/motion-drag'
import {
  findDropContainer,
  findDropIndex,
  getEdgeScrollDelta,
} from '@/lib/motion-drag'
import { rectToDragRect } from '../geometry'

export function useDragDestination({
  containersRef,
  sessionRef,
  scrollAreasRef,
  overlayX,
  overlayY,
}: {
  containersRef: RefObject<Map<string, ContainerRegistration>>
  sessionRef: RefObject<DragSession | null>
  scrollAreasRef: RefObject<CrossListScrollArea[]>
  overlayX: MotionValue<number>
  overlayY: MotionValue<number>
}) {
  const frameRef = useRef<number | null>(null)

  const pointRef = useRef<DragPoint | null>(null)

  const [destination, setDestination] = useState<DropDestination | null>(null)

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const resolveDestination = useCallback(
    (point: DragPoint): DropDestination | null => {
      const session = sessionRef.current

      if (!session) return null

      const containers = [...containersRef.current.values()]

      const containerId = findDropContainer(
        point,
        containers.map((container) =>
          rectToDragRect(
            container.id,
            container.element.getBoundingClientRect(),
          ),
        ),
      )

      if (!containerId) return null

      const container = containersRef.current.get(containerId)

      if (!container) return null

      const activeItemId = session.itemId

      const itemRects = [
        ...container.element.querySelectorAll<HTMLElement>(
          '[data-motion-drag-item]',
        ),
      ]
        .filter(
          (element) =>
            element.dataset.motionDragContainerId === containerId &&
            element.dataset.motionDragItem !== activeItemId,
        )
        .map((element) =>
          rectToDragRect(
            element.dataset.motionDragItem ?? '',
            element.getBoundingClientRect(),
          ),
        )

      return {
        containerId,
        index: findDropIndex(point, itemRects, container.axis),
      }
    },
    [],
  )

  const updateDestination = useCallback(
    (point: DragPoint) => {
      const session = sessionRef.current

      if (!session?.active) return

      const next = resolveDestination(point)

      session.destination = next

      setDestination((current) =>
        current?.containerId === next?.containerId &&
        current?.index === next?.index
          ? current
          : next,
      )
    },
    [resolveDestination],
  )

  const runDragFrame = useCallback(
    function runDragFrame() {
      frameRef.current = null

      const session = sessionRef.current
      const point = pointRef.current

      if (!session?.active || !point) return

      overlayX.set(point.x - session.startPoint.x)
      overlayY.set(point.y - session.startPoint.y)
      updateDestination(point)

      const scrolledElements = new Set<HTMLElement>()
      let didScroll = false

      const scroll = (
        element: HTMLElement | null,
        axis: DragAxis,
        threshold = 56,
        maxStep = 18,
      ) => {
        if (!element || scrolledElements.has(element)) return

        const rect = element.getBoundingClientRect()
        const crossCoordinate = axis === 'x' ? point.y : point.x
        const crossStart = axis === 'x' ? rect.top : rect.left
        const crossEnd = axis === 'x' ? rect.bottom : rect.right

        if (crossCoordinate < crossStart || crossCoordinate > crossEnd) return

        scrolledElements.add(element)

        const delta = getEdgeScrollDelta(point, rect, axis, threshold, maxStep)
        const before = axis === 'x' ? element.scrollLeft : element.scrollTop

        if (delta === 0) return
        if (axis === 'x') element.scrollBy({ left: delta, behavior: 'instant' })
        else element.scrollBy({ top: delta, behavior: 'instant' })

        const after = axis === 'x' ? element.scrollLeft : element.scrollTop

        didScroll ||= after !== before
      }

      for (const area of scrollAreasRef.current)
        scroll(area.ref.current, area.axis, area.threshold, area.maxStep)

      const targetContainer = session.destination
        ? containersRef.current.get(session.destination.containerId)
        : null

      if (targetContainer)
        scroll(targetContainer.scrollElement, targetContainer.axis)

      if (didScroll) {
        updateDestination(point)
        frameRef.current = requestAnimationFrame(runDragFrame)
      }
    },
    [overlayX, overlayY, updateDestination],
  )

  const updateDrag = useCallback(
    (point: DragPoint) => {
      if (!sessionRef.current?.active) return

      pointRef.current = point

      if (frameRef.current === null)
        frameRef.current = requestAnimationFrame(runDragFrame)
    },
    [runDragFrame],
  )

  return {
    destination,
    setDestination,
    pointRef,
    cancelFrame,
    updateDestination,
    updateDrag,
  }
}
