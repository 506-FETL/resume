import type { ReactNode } from 'react'
import type { VisibilityItemsType } from '@/lib/schema'
import { GripVertical } from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import {
  autoScrollAtEdge,
  MOTION_REORDER_TRANSITION,
} from '@/components/ui/motion-reorder'
import { Tab } from '@/components/ui/side-tabs'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SortableTabProps {
  id: VisibilityItemsType
  label: string
  icon: ReactNode
  visible: boolean
  active: boolean
  onActivate: () => void
  onToggleVisibility: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onKeyboardMove: (id: VisibilityItemsType, direction: -1 | 1) => void
}

export function SortableTab({
  id,
  label,
  icon,
  visible,
  active,
  onActivate,
  onToggleVisibility,
  onDragStart,
  onDragEnd,
  onKeyboardMove,
}: SortableTabProps) {
  const dragControls = useDragControls()
  const reduceMotion = useReducedMotion()
  const [isDragging, setIsDragging] = useState(false)
  const itemRef = useRef<HTMLDivElement | null>(null)

  return (
    <Reorder.Item
      as="div"
      ref={itemRef}
      value={id}
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      onDragStart={() => {
        setIsDragging(true)
        onDragStart()
      }}
      onDragEnd={() => {
        setIsDragging(false)
        onDragEnd()
      }}
      whileDrag={reduceMotion
        ? { zIndex: 10 }
        : {
            scale: 1.015,
            boxShadow: '0 12px 28px rgb(0 0 0 / 0.16)',
            zIndex: 10,
          }}
      transition={MOTION_REORDER_TRANSITION}
      onDrag={(_event, info) => {
        const scrollContainer = itemRef.current?.parentElement?.parentElement
        autoScrollAtEdge(scrollContainer ?? null, info.point, 'x')
      }}
      className="relative flex flex-col items-center justify-end gap-2 select-none"
      data-active={active}
      data-dragging={isDragging || undefined}
    >
      <div className="flex flex-row items-center gap-1.5">
        <span
          role="button"
          tabIndex={0}
          className="touch-none cursor-grab rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          aria-label={`拖动 ${label} 模块`}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          onPointerDown={event => dragControls.start(event)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              onKeyboardMove(id, event.key === 'ArrowLeft' ? -1 : 1)
            }
          }}
        >
          <GripVertical className="size-4" />
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <div onPointerDownCapture={event => event.stopPropagation()}>
              <Switch checked={visible} onCheckedChange={onToggleVisibility} />
            </div>
          </TooltipTrigger>
          <TooltipContent>点击可隐藏模块</TooltipContent>
        </Tooltip>
      </div>

      <Tab id={id} onClick={onActivate} disabled={!visible}>
        {icon}
        {label}
      </Tab>
    </Reorder.Item>
  )
}
