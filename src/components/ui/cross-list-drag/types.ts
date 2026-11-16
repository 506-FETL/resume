import type {
  RefObject,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEventHandler,
  TouchEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
} from 'react'
import type { DragAxis, DragPoint, DropDestination } from '@/lib/motion-drag'

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

export interface ContainerRegistration {
  id: string
  label: string
  element: HTMLElement
  itemIds: string[]
  axis: DragAxis
  scrollElement: HTMLElement | null
}

export interface DragSession {
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

export interface ActiveDrag {
  kind: DragSession['kind']
  itemId: string
  sourceId: string
  sourceIndex: number
  startRect: DOMRect
}

export interface PreviewSettlement {
  session: DragSession
  pendingDrop: boolean
  targetTransform: string | null
}

export interface CrossListDragContextValue {
  active: ActiveDrag | null
  preview: ActiveDrag | null
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

export interface CrossListDragItemProps {
  'data-motion-drag-item': string
  'data-motion-drag-container-id': string
  role: 'listitem'
  tabIndex: number
  'aria-roledescription': string
  'aria-keyshortcuts': string
  onPointerDown: PointerEventHandler<HTMLElement>
  onTouchStart: TouchEventHandler<HTMLElement>
  onKeyDown: KeyboardEventHandler<HTMLElement>
  onClickCapture: MouseEventHandler<HTMLElement>
}
