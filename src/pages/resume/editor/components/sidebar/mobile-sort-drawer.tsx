import type { ReactNode, RefObject } from 'react'
import type { ORDERType } from '@/lib/schema'
import { GripVertical } from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  autoScrollAtEdge,
  MOTION_REORDER_TRANSITION,
  useMotionReorder,
} from '@/components/ui/motion-reorder'
import { ITEMS } from '../../const'

interface MobileSortDrawerProps {
  open: boolean
  order: ORDERType[]
  onOpenChange: (open: boolean) => void
  onConfirm: (order: ORDERType[]) => void
}

function MobileSortItem({
  id,
  label,
  icon,
  scrollRef,
  onDragStart,
  onDragEnd,
  onKeyboardMove,
}: {
  id: ORDERType
  label: string
  icon: ReactNode
  scrollRef: RefObject<HTMLUListElement | null>
  onDragStart: () => void
  onDragEnd: () => void
  onKeyboardMove: (id: ORDERType, direction: -1 | 1) => void
}) {
  const dragControls = useDragControls()
  const reduceMotion = useReducedMotion()

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      data-sort-id={id}
      data-base-ui-swipe-ignore=""
      layout="position"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={reduceMotion
        ? { zIndex: 10 }
        : {
            scale: 1.015,
            boxShadow: '0 12px 28px rgb(0 0 0 / 0.16)',
            zIndex: 10,
          }}
      transition={reduceMotion ? { duration: 0 } : MOTION_REORDER_TRANSITION}
      onDrag={(_event, info) => {
        autoScrollAtEdge(scrollRef.current, info.point, 'y')
      }}
      className="relative flex select-none items-center gap-2 rounded-md border bg-background px-2 py-2"
    >
      <span
        role="button"
        tabIndex={0}
        data-base-ui-swipe-ignore=""
        className="touch-none flex size-8 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={`拖动 ${label}`}
        aria-keyshortcuts="ArrowUp ArrowDown"
        onPointerDown={event => dragControls.start(event)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            onKeyboardMove(id, event.key === 'ArrowUp' ? -1 : 1)
          }
        }}
      >
        <GripVertical className="size-4" />
      </span>
      <span className="text-foreground/80">{icon}</span>
      <span className="min-w-0 truncate text-sm">{label}</span>
    </Reorder.Item>
  )
}

export function MobileSortDrawer({ open, order, onOpenChange, onConfirm }: MobileSortDrawerProps) {
  const initialDraft = order.filter(id => id !== 'basics')
  const listRef = useRef<HTMLUListElement | null>(null)
  const wasOpenRef = useRef(false)
  const {
    draft,
    setDraft,
    startDragging,
    finishDragging,
    moveByKeyboard,
  } = useMotionReorder({
    values: initialDraft,
    axis: 'y',
    onCommit: () => {},
    commitOnKeyboard: false,
    syncValuesWhileIdle: false,
  })

  useEffect(() => {
    if (open && !wasOpenRef.current)
      setDraft(order.filter(id => id !== 'basics'))
    wasOpenRef.current = open
  }, [open, order, setDraft])

  const handleConfirm = () => {
    onConfirm(['basics', ...draft])
    onOpenChange(false)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      modal
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent
        aria-label="调整模块顺序"
        className="z-[60]"
      >
        <DrawerHeader className="px-6 pt-4 pb-4 text-left">
          <DrawerTitle className="text-lg font-semibold">调整模块顺序</DrawerTitle>
          <DrawerDescription className="text-sm">
            按住左侧拖动图标调整顺序，确认后应用。
          </DrawerDescription>
        </DrawerHeader>

        <Reorder.Group
          ref={listRef}
          axis="y"
          values={draft}
          onReorder={setDraft}
          layoutScroll
          data-base-ui-swipe-ignore=""
          className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 pb-2"
        >
          {draft.map((id) => {
            const item = ITEMS.find(it => it.id === id)
            if (!item)
              return null
            return (
              <MobileSortItem
                key={id}
                id={id}
                label={item.label}
                icon={item.icon}
                scrollRef={listRef}
                onDragStart={startDragging}
                onDragEnd={finishDragging}
                onKeyboardMove={(itemId, direction) => {
                  moveByKeyboard(itemId as Exclude<ORDERType, 'basics'>, direction)
                }}
              />
            )
          })}
        </Reorder.Group>

        <DrawerFooter className="mt-0 flex-row gap-3 border-t px-6 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            确认
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
