import type { DropResult } from '@hello-pangea/dnd'
import type { ORDERType } from '@/lib/schema'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ITEMS } from '../../const'

interface MobileSortDialogProps {
  open: boolean
  order: ORDERType[]
  onOpenChange: (open: boolean) => void
  onConfirm: (order: ORDERType[]) => void
}

const DROPPABLE_ID = 'resume-sidebar-mobile-sort'

export function MobileSortDialog({ open, order, onOpenChange, onConfirm }: MobileSortDialogProps) {
  const initialDraft = order.filter(id => id !== 'basics')
  const [draft, setDraft] = useState<ORDERType[]>(initialDraft)

  useEffect(() => {
    if (open)
      setDraft(order.filter(id => id !== 'basics'))
  }, [open, order])

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index)
      return
    const next = [...draft]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    setDraft(next)
  }

  const handleConfirm = () => {
    onConfirm(['basics', ...draft])
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[60] max-h-[80vh] gap-0 rounded-t-lg rounded-b-none border-x-0 px-0 pb-0"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>调整模块顺序</SheetTitle>
          <SheetDescription>
            长按并拖动模块进行排序，确认后应用。
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId={DROPPABLE_ID}>
              {droppable => (
                <ul
                  ref={droppable.innerRef}
                  {...droppable.droppableProps}
                  className="flex flex-col gap-1.5"
                >
                  {draft.map((id, index) => {
                    const item = ITEMS.find(it => it.id === id)
                    if (!item)
                      return null
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {draggable => (
                          <li
                            ref={draggable.innerRef}
                            {...draggable.draggableProps}
                            {...draggable.dragHandleProps}
                            style={draggable.draggableProps.style}
                            className="touch-none flex items-center gap-3 rounded-md border bg-background px-3 py-2 select-none cursor-grab active:cursor-grabbing"
                            aria-label={`拖动 ${item.label}`}
                          >
                            <span className="text-foreground/80">{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                          </li>
                        )}
                      </Draggable>
                    )
                  })}
                  {droppable.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <SheetFooter className="mt-0 flex-row gap-3 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            确认
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
