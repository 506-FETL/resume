/* eslint-disable react-refresh/only-export-components */
import type {
  KeyboardEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  RefCallback,
  RefObject,
  TouchEventHandler,
} from 'react'
import type { DragAxis, DragPoint, DropDestination } from '@/lib/motion-drag'
import { motion, useMotionValue, useReducedMotion } from 'motion/react'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  findDropContainer,
  findDropIndex,
  getEdgeScrollDelta,
} from '@/lib/motion-drag'

const DRAG_ACTIVATION_DISTANCE = 5
const TOUCH_ACTIVATION_DELAY = 180
const TOUCH_ACTIVATION_TOLERANCE = 7
const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-no-drag]',
].join(',')

export interface CrossListDropResult {
  itemId: string
  sourceId: string
  sourceIndex: number
  destinationId: string
  destinationIndex: number
}

export interface CrossListScrollArea {
  ref: RefObject<HTMLElement | null>
  axis: DragAxis
  threshold?: number
  maxStep?: number
}

interface ContainerRegistration {
  id: string
  label: string
  element: HTMLElement
  itemIds: string[]
  axis: DragAxis
  scrollElement: HTMLElement | null
}

interface DragSession {
  kind: 'pointer' | 'touch' | 'keyboard'
  pointerId: number
  itemId: string
  sourceId: string
  sourceIndex: number
  itemElement: HTMLElement
  startPoint: DragPoint
  startRect: DOMRect
  active: boolean
  touchTimer: number | null
  destination: DropDestination | null
}

interface ActiveDrag {
  kind: DragSession['kind']
  itemId: string
  sourceId: string
  sourceIndex: number
  startRect: DOMRect
}

interface CrossListDragContextValue {
  active: ActiveDrag | null
  destination: DropDestination | null
  registerContainer: (container: ContainerRegistration) => () => void
  beginPointerDrag: (
    event: ReactPointerEvent<HTMLElement>,
    item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
  ) => void
  beginTouchDrag: (
    event: ReactTouchEvent<HTMLElement>,
    item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
  ) => void
  handleKeyboardDrag: (
    event: ReactKeyboardEvent<HTMLElement>,
    item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
  ) => void
  suppressClick: (event: ReactMouseEvent<HTMLElement>, itemId: string) => void
}

interface CrossListDragItemProps {
  'data-motion-drag-item': string
  'data-motion-drag-container-id': string
  'role': 'listitem'
  'tabIndex': number
  'aria-roledescription': string
  'aria-keyshortcuts': string
  'onPointerDown': PointerEventHandler<HTMLElement>
  'onTouchStart': TouchEventHandler<HTMLElement>
  'onKeyDown': KeyboardEventHandler<HTMLElement>
  'onClickCapture': MouseEventHandler<HTMLElement>
}

const CrossListDragContext = createContext<CrossListDragContextValue | null>(null)

function rectToDragRect(id: string, rect: DOMRect) {
  return {
    id,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  }
}

function isInteractiveTarget(target: EventTarget | null, currentTarget: HTMLElement): boolean {
  if (!(target instanceof Element))
    return false
  const interactive = target.closest(INTERACTIVE_SELECTOR)
  return interactive !== null && interactive !== currentTarget
}

function distanceBetween(left: DragPoint, right: DragPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

export function CrossListDragProvider({
  onDrop,
  renderOverlay,
  scrollAreas = [],
  children,
}: {
  onDrop: (result: CrossListDropResult) => void
  renderOverlay: (itemId: string) => ReactNode
  scrollAreas?: CrossListScrollArea[]
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const containersRef = useRef(new Map<string, ContainerRegistration>())
  const sessionRef = useRef<DragSession | null>(null)
  const scrollAreasRef = useRef(scrollAreas)
  const onDropRef = useRef(onDrop)
  const suppressClickRef = useRef<{ itemId: string, until: number } | null>(null)
  const frameRef = useRef<number | null>(null)
  const bodyStyleRef = useRef<{ cursor: string, userSelect: string } | null>(null)
  const overlayX = useMotionValue(0)
  const overlayY = useMotionValue(0)
  const [active, setActive] = useState<ActiveDrag | null>(null)
  const [destination, setDestination] = useState<DropDestination | null>(null)
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
      if (containersRef.current.get(container.id)?.element === container.element)
        containersRef.current.delete(container.id)
    }
  }, [])

  const restoreBodyStyles = useCallback(() => {
    if (!bodyStyleRef.current)
      return
    document.body.style.cursor = bodyStyleRef.current.cursor
    document.body.style.userSelect = bodyStyleRef.current.userSelect
    bodyStyleRef.current = null
  }, [])

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const clearSession = useCallback((updateState = true) => {
    const session = sessionRef.current
    if (session?.touchTimer != null)
      window.clearTimeout(session.touchTimer)
    if (session?.kind === 'pointer' && session.itemElement.hasPointerCapture(session.pointerId))
      session.itemElement.releasePointerCapture(session.pointerId)

    sessionRef.current = null
    cancelFrame()
    restoreBodyStyles()
    if (updateState) {
      setActive(null)
      setDestination(null)
    }
  }, [cancelFrame, restoreBodyStyles])

  const resolveDestination = useCallback((point: DragPoint): DropDestination | null => {
    const session = sessionRef.current
    if (!session)
      return null

    const containers = [...containersRef.current.values()]
    const containerId = findDropContainer(point, containers.map(container => (
      rectToDragRect(container.id, container.element.getBoundingClientRect())
    )))
    if (!containerId)
      return null

    const container = containersRef.current.get(containerId)
    if (!container)
      return null

    const activeItemId = session.itemId
    const itemRects = [...container.element.querySelectorAll<HTMLElement>('[data-motion-drag-item]')]
      .filter(element => (
        element.dataset.motionDragContainerId === containerId
        && element.dataset.motionDragItem !== activeItemId
      ))
      .map(element => rectToDragRect(
        element.dataset.motionDragItem ?? '',
        element.getBoundingClientRect(),
      ))

    return {
      containerId,
      index: findDropIndex(point, itemRects, container.axis),
    }
  }, [])

  const updateDestination = useCallback((point: DragPoint) => {
    const session = sessionRef.current
    if (!session?.active)
      return
    const next = resolveDestination(point)
    session.destination = next
    setDestination(current => (
      current?.containerId === next?.containerId && current?.index === next?.index
        ? current
        : next
    ))
  }, [resolveDestination])

  const runAutoScroll = useCallback((point: DragPoint) => {
    const session = sessionRef.current
    if (!session?.active)
      return

    const scrolledElements = new Set<HTMLElement>()
    let didScroll = false
    const scroll = (
      element: HTMLElement | null,
      axis: DragAxis,
      threshold = 56,
      maxStep = 18,
    ) => {
      if (!element || scrolledElements.has(element))
        return
      scrolledElements.add(element)
      const delta = getEdgeScrollDelta(point, element.getBoundingClientRect(), axis, threshold, maxStep)
      if (delta === 0)
        return
      if (axis === 'x')
        element.scrollBy({ left: delta })
      else
        element.scrollBy({ top: delta })
      didScroll = true
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
      frameRef.current = requestAnimationFrame(() => runAutoScroll(point))
    }
    else {
      frameRef.current = null
    }
  }, [updateDestination])

  const updateDrag = useCallback((point: DragPoint) => {
    const session = sessionRef.current
    if (!session?.active)
      return
    overlayX.set(point.x - session.startPoint.x)
    overlayY.set(point.y - session.startPoint.y)
    updateDestination(point)
    cancelFrame()
    frameRef.current = requestAnimationFrame(() => runAutoScroll(point))
  }, [cancelFrame, overlayX, overlayY, runAutoScroll, updateDestination])

  const activateSession = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.active)
      return
    session.active = true
    session.touchTimer = null
    if (session.kind === 'pointer' && !session.itemElement.hasPointerCapture(session.pointerId))
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
    setActive({
      kind: session.kind,
      itemId: session.itemId,
      sourceId: session.sourceId,
      sourceIndex: session.sourceIndex,
      startRect: session.startRect,
    })
    updateDestination(session.startPoint)
  }, [overlayX, overlayY, updateDestination])

  const finishSession = useCallback(() => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    const destinationIsValid = session.destination !== null
      && containersRef.current.has(session.destination.containerId)
    const result = session.active && session.destination && destinationIsValid
      ? {
          itemId: session.itemId,
          sourceId: session.sourceId,
          sourceIndex: session.sourceIndex,
          destinationId: session.destination.containerId,
          destinationIndex: session.destination.index,
        }
      : null

    if (session.active && session.kind !== 'keyboard') {
      suppressClickRef.current = {
        itemId: session.itemId,
        until: performance.now() + 350,
      }
    }
    clearSession()
    if (result)
      onDropRef.current(result)
  }, [clearSession])

  const beginPointerDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
  ) => {
    if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0 || sessionRef.current)
      return
    if (isInteractiveTarget(event.target, event.currentTarget))
      return

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
  }, [])

  const beginTouchDrag = useCallback((
    event: ReactTouchEvent<HTMLElement>,
    item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
  ) => {
    if (event.touches.length !== 1 || sessionRef.current)
      return
    if (isInteractiveTarget(event.target, event.currentTarget))
      return

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
    session.touchTimer = window.setTimeout(activateSession, TOUCH_ACTIVATION_DELAY)
    sessionRef.current = session
  }, [activateSession])

  const describeDestination = useCallback((next: DropDestination): string => {
    const container = containersRef.current.get(next.containerId)
    if (!container)
      return ''
    return `已移动到${container.label}第 ${next.index + 1} 位`
  }, [])

  const handleKeyboardDrag = useCallback((
    event: ReactKeyboardEvent<HTMLElement>,
    item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
  ) => {
    if (isInteractiveTarget(event.target, event.currentTarget))
      return

    const session = sessionRef.current
    if (!session) {
      if (event.key !== ' ' && event.key !== 'Enter')
        return
      const source = containersRef.current.get(item.sourceId)
      if (!source)
        return

      event.preventDefault()
      event.stopPropagation()
      const startRect = event.currentTarget.getBoundingClientRect()
      const initialDestination = {
        containerId: item.sourceId,
        index: item.sourceIndex,
      }
      sessionRef.current = {
        kind: 'keyboard',
        pointerId: -1,
        ...item,
        itemElement: event.currentTarget,
        startPoint: { x: startRect.left, y: startRect.top },
        startRect,
        active: true,
        touchTimer: null,
        destination: initialDestination,
      }
      setActive({ kind: 'keyboard', ...item, startRect })
      setDestination(initialDestination)
      setLiveMessage(`已拾取可拖动项目，当前位置为${source.label}第 ${item.sourceIndex + 1} 位`)
      return
    }

    if (session.kind !== 'keyboard' || session.itemId !== item.itemId)
      return

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      clearSession()
      setLiveMessage('已取消拖动')
      return
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      const finalDestination = session.destination
      finishSession()
      setLiveMessage(finalDestination
        ? `已放置，${describeDestination(finalDestination)}`
        : '已取消拖动')
      return
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
      return

    event.preventDefault()
    event.stopPropagation()
    const containers = [...containersRef.current.values()]
    const currentDestination = session.destination ?? {
      containerId: session.sourceId,
      index: session.sourceIndex,
    }
    let target = containersRef.current.get(currentDestination.containerId)
    if (!target)
      return

    let nextIndex = currentDestination.index
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const currentContainerIndex = containers.findIndex(container => container.id === target?.id)
      const containerDelta = event.key === 'ArrowLeft' ? -1 : 1
      const nextContainer = containers[currentContainerIndex + containerDelta]
      if (!nextContainer)
        return
      target = nextContainer
      const targetLength = target.itemIds.filter(id => id !== session.itemId).length
      nextIndex = Math.min(nextIndex, targetLength)
    }
    else {
      const itemCountWithoutActive = target.itemIds.filter(id => id !== session.itemId).length
      const itemDelta = event.key === 'ArrowUp' ? -1 : 1
      nextIndex = Math.max(0, Math.min(itemCountWithoutActive, nextIndex + itemDelta))
      if (nextIndex === currentDestination.index)
        return
    }

    const nextDestination = { containerId: target.id, index: nextIndex }
    session.destination = nextDestination
    setDestination(nextDestination)
    setLiveMessage(describeDestination(nextDestination))
  }, [clearSession, describeDestination, finishSession])

  useEffect(() => {
    if (active?.kind !== 'keyboard')
      return

    const cancelKeyboardSession = () => {
      if (sessionRef.current?.kind !== 'keyboard')
        return
      clearSession()
      setLiveMessage('已取消拖动')
    }
    const handleFocusIn = (event: FocusEvent) => {
      const session = sessionRef.current
      if (session?.kind !== 'keyboard' || !(event.target instanceof Node))
        return
      if (!session.itemElement.contains(event.target))
        cancelKeyboardSession()
    }
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || sessionRef.current?.kind !== 'keyboard')
        return
      event.preventDefault()
      event.stopPropagation()
      cancelKeyboardSession()
    }

    document.addEventListener('focusin', handleFocusIn, true)
    window.addEventListener('keydown', handleGlobalKeyDown, true)
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true)
      window.removeEventListener('keydown', handleGlobalKeyDown, true)
    }
  }, [active, clearSession])

  useEffect(() => {
    const session = sessionRef.current
    if (session?.kind !== 'keyboard')
      return
    const source = containersRef.current.get(session.sourceId)
    const target = session.destination
      ? containersRef.current.get(session.destination.containerId)
      : null
    if (
      !session.itemElement.isConnected
      || !source?.itemIds.includes(session.itemId)
      || !target
    ) {
      clearSession()
      setLiveMessage('拖动项目已变化，已取消拖动')
    }
  }, [active, children, clearSession, destination])

  const suppressClick = useCallback((event: ReactMouseEvent<HTMLElement>, itemId: string) => {
    const suppressed = suppressClickRef.current
    if (!suppressed || suppressed.itemId !== itemId || performance.now() > suppressed.until)
      return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = null
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || session.kind !== 'pointer' || session.pointerId !== event.pointerId)
        return
      const point = { x: event.clientX, y: event.clientY }
      if (!session.active && distanceBetween(session.startPoint, point) >= DRAG_ACTIVATION_DISTANCE)
        activateSession()
      if (!session.active)
        return
      if (event.cancelable)
        event.preventDefault()
      updateDrag(point)
    }

    const handlePointerUp = (event: PointerEvent) => {
      const session = sessionRef.current
      if (session?.kind === 'pointer' && session.pointerId === event.pointerId) {
        if (session.active)
          updateDrag({ x: event.clientX, y: event.clientY })
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
      if (!session || session.kind !== 'touch')
        return
      const touch = [...event.touches].find(item => item.identifier === session.pointerId)
      if (!touch)
        return
      const point = { x: touch.clientX, y: touch.clientY }
      if (!session.active && distanceBetween(session.startPoint, point) > TOUCH_ACTIVATION_TOLERANCE) {
        clearSession()
        return
      }
      if (!session.active)
        return
      if (event.cancelable)
        event.preventDefault()
      updateDrag(point)
    }

    const handleTouchEnd = (event: TouchEvent) => {
      const session = sessionRef.current
      if (!session || session.kind !== 'touch')
        return
      const touch = [...event.changedTouches].find(item => item.identifier === session.pointerId)
      if (!touch)
        return
      if (session.active)
        updateDrag({ x: touch.clientX, y: touch.clientY })
      finishSession()
    }

    const handleTouchCancel = (event: TouchEvent) => {
      const session = sessionRef.current
      if (!session || session.kind !== 'touch')
        return
      if ([...event.changedTouches].some(item => item.identifier === session.pointerId))
        clearSession()
    }

    const handleBlur = () => clearSession()

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchCancel)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
      window.removeEventListener('blur', handleBlur)
      clearSession(false)
    }
  }, [activateSession, clearSession, finishSession, updateDrag])

  const context = useMemo<CrossListDragContextValue>(() => ({
    active,
    destination,
    registerContainer,
    beginPointerDrag,
    beginTouchDrag,
    handleKeyboardDrag,
    suppressClick,
  }), [
    active,
    beginPointerDrag,
    beginTouchDrag,
    destination,
    handleKeyboardDrag,
    registerContainer,
    suppressClick,
  ])

  return (
    <CrossListDragContext value={context}>
      {children}
      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      {active?.kind !== 'keyboard' && active && typeof document !== 'undefined' && createPortal(
        <motion.div
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 0.98, scale: reduceMotion ? 1 : 1.015 }}
          transition={{ duration: reduceMotion ? 0 : 0.12 }}
          style={{
            position: 'fixed',
            left: active.startRect.left,
            top: active.startRect.top,
            width: active.startRect.width,
            minHeight: active.startRect.height,
            x: overlayX,
            y: overlayY,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {renderOverlay(active.itemId)}
        </motion.div>,
        document.body,
      )}
    </CrossListDragContext>
  )
}

function useCrossListDragContext(): CrossListDragContextValue {
  const context = use(CrossListDragContext)
  if (!context)
    throw new Error('Cross-list drag parts must be placed within CrossListDragProvider')
  return context
}

export function useCrossListContainer({
  id,
  label = id,
  itemIds,
  axis = 'y',
  scrollRef,
}: {
  id: string
  label?: string
  itemIds: string[]
  axis?: DragAxis
  scrollRef?: RefObject<HTMLElement | null>
}): {
  ref: RefCallback<HTMLElement>
  active: boolean
  destinationIndex: number | null
  activeSourceId: string | null
  activeSourceIndex: number | null
} {
  const context = useCrossListDragContext()
  const { active, registerContainer, destination } = context
  const unregisterRef = useRef<(() => void) | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const itemIdsKey = itemIds.join('\u0000')
  const registeredItemIds = useMemo(
    () => itemIdsKey === '' ? [] : itemIdsKey.split('\u0000'),
    [itemIdsKey],
  )
  const registrationRef = useRef({ label, itemIds: registeredItemIds, axis, scrollRef })
  registrationRef.current = { label, itemIds: registeredItemIds, axis, scrollRef }

  const ref = useCallback<RefCallback<HTMLElement>>((element) => {
    elementRef.current = element
    if (!element) {
      unregisterRef.current?.()
      unregisterRef.current = null
      return
    }
    const registration = registrationRef.current
    unregisterRef.current = registerContainer({
      id,
      label: registration.label,
      element,
      itemIds: registration.itemIds,
      axis: registration.axis,
      scrollElement: registration.scrollRef?.current ?? element,
    })
  }, [id, registerContainer])

  useEffect(() => {
    const element = elementRef.current
    if (element) {
      const registration = registrationRef.current
      unregisterRef.current = registerContainer({
        id,
        label: registration.label,
        element,
        itemIds: registration.itemIds,
        axis: registration.axis,
        scrollElement: registration.scrollRef?.current ?? element,
      })
    }
  }, [axis, id, label, registerContainer, registeredItemIds, scrollRef])

  useEffect(() => () => unregisterRef.current?.(), [])

  return {
    ref,
    active: destination?.containerId === id,
    destinationIndex: destination?.containerId === id
      ? destination.index
      : null,
    activeSourceId: active?.sourceId ?? null,
    activeSourceIndex: active?.sourceIndex ?? null,
  }
}

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
  getDragProps: () => CrossListDragItemProps
} {
  const context = useCrossListDragContext()
  const {
    active,
    beginPointerDrag,
    beginTouchDrag,
    handleKeyboardDrag,
    suppressClick,
  } = context
  const getDragProps = useCallback((): CrossListDragItemProps => ({
    'data-motion-drag-item': id,
    'data-motion-drag-container-id': containerId,
    'role': 'listitem',
    'tabIndex': 0,
    'aria-roledescription': '可拖动项目',
    'aria-keyshortcuts': 'Space Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape',
    'onPointerDown': event => beginPointerDrag(event, {
      itemId: id,
      sourceId: containerId,
      sourceIndex: index,
    }),
    'onTouchStart': event => beginTouchDrag(event, {
      itemId: id,
      sourceId: containerId,
      sourceIndex: index,
    }),
    'onKeyDown': event => handleKeyboardDrag(event, {
      itemId: id,
      sourceId: containerId,
      sourceIndex: index,
    }),
    'onClickCapture': event => suppressClick(event, id),
  }), [
    beginPointerDrag,
    beginTouchDrag,
    containerId,
    handleKeyboardDrag,
    id,
    index,
    suppressClick,
  ])

  return {
    dragging: active?.itemId === id,
    getDragProps,
  }
}
