import type { ReactNode, RefObject } from 'react'
import type { ORDERType } from '@/lib/schema'
import { GripVertical, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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
  onKeyboardMove,
}: {
  id: ORDERType
  label: string
  icon: ReactNode
  scrollRef: RefObject<HTMLUListElement | null>
  onKeyboardMove: (id: ORDERType, direction: -1 | 1) => void
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      data-sort-id={id}
      data-base-ui-swipe-ignore=""
      layout="position"
      whileDrag={{
        scale: 1.015,
        boxShadow: '0 12px 28px rgb(0 0 0 / 0.16)',
        zIndex: 10,
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      onDrag={(_event, info) => {
        const container = scrollRef.current
        if (!container)
          return
        const bounds = container.getBoundingClientRect()
        const edge = 56
        if (info.point.y < bounds.top + edge)
          container.scrollBy({ top: -12 })
        else if (info.point.y > bounds.bottom - edge)
          container.scrollBy({ top: 12 })
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
  const [draft, setDraft] = useState<ORDERType[]>(initialDraft)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    if (open)
      setDraft(order.filter(id => id !== 'basics'))
  }, [open, order])

  const handleKeyboardMove = (id: ORDERType, direction: -1 | 1) => {
    const sourceIndex = draft.indexOf(id)
    const destinationIndex = sourceIndex + direction
    if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= draft.length)
      return
    const next = [...draft]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(destinationIndex, 0, moved)
    setDraft(next)
  }

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
        className="z-[60] [--drawer-content-height:min(80dvh,42rem)] [--drawer-content-max-height:80dvh]"
      >
        <DrawerHeader className="relative px-6 pt-4 pb-4 text-left">
          <DrawerTitle className="pr-10 text-lg font-semibold">调整模块顺序</DrawerTitle>
          <DrawerDescription className="pr-10 text-sm">
            按住左侧拖动图标调整顺序，确认后应用。
          </DrawerDescription>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="absolute right-4 top-3"
            aria-label="关闭模块排序"
            onClick={() => onOpenChange(false)}
          >
            <X />
          </Button>
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
                onKeyboardMove={handleKeyboardMove}
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
