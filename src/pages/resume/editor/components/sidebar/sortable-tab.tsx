import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { ReactNode, Ref } from 'react'
import type { VisibilityItemsType } from '@/lib/schema'
import { GripVertical } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Tab } from '@/components/ui/side-tabs'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SortableTabProps {
  id: VisibilityItemsType
  label: string
  icon: ReactNode
  visible: boolean
  active: boolean
  isDragging: boolean
  innerRef: Ref<HTMLDivElement>
  draggableProps: DraggableProvidedDraggableProps
  dragHandleProps: DraggableProvidedDragHandleProps | null
  onActivate: () => void
  onToggleVisibility: () => void
}

export function SortableTab({
  id,
  label,
  icon,
  visible,
  active,
  isDragging,
  innerRef,
  draggableProps,
  dragHandleProps,
  onActivate,
  onToggleVisibility,
}: SortableTabProps) {
  const content = (
    <div
      ref={innerRef}
      {...draggableProps}
      className="flex flex-col items-center justify-end gap-2 select-none"
      data-active={active}
    >
      <div className="flex flex-row items-center gap-1.5">
        <span
          {...dragHandleProps}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label={`拖动 ${label} 模块`}
        >
          <GripVertical className="size-4" />
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <div onPointerDownCapture={e => e.stopPropagation()}>
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
    </div>
  )

  if (isDragging && typeof document !== 'undefined')
    return createPortal(content, document.body)

  return content
}
