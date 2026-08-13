import type { DropResult } from '@hello-pangea/dnd'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { SideTabs, SideTabsWrapper, ViewPort } from '@/components/ui/side-tabs'
import { ITEMS } from '../../const'
import { FixedTab } from './fixed-tab'
import { MobileSortDrawer } from './mobile-sort-drawer'
import { SortableTab } from './sortable-tab'
import { StaticTab } from './static-tab'

interface SidebarEditorProps {
  activeTabId: ORDERType
  order: ORDERType[]
  visibilityState: Record<string, boolean>
  fill: string
  stroke: string
  isMobile: boolean
  sortDialogOpen: boolean
  onSortDialogOpenChange: (open: boolean) => void
  onUpdateActiveTabId: (id: ORDERType) => void
  onUpdateOrder: (order: ORDERType[]) => void
  onToggleVisibility: (id: VisibilityItemsType) => void
}

const DROPPABLE_ID = 'resume-sidebar-tabs'

export default function SidebarEditor({
  activeTabId,
  order,
  visibilityState,
  fill,
  stroke,
  isMobile,
  sortDialogOpen,
  onSortDialogOpenChange,
  onUpdateActiveTabId,
  onUpdateOrder,
  onToggleVisibility,
}: SidebarEditorProps) {
  const orderDraggable = order.filter(id => id !== 'basics')
  const basicsItem = ITEMS.find(item => item.id === 'basics')!

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index)
      return
    const next = [...orderDraggable]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onUpdateOrder(['basics', ...next])
  }

  const renderBasics = () => (
    <FixedTab
      id={'basics' as VisibilityItemsType}
      label={basicsItem.label}
      icon={basicsItem.icon}
      visible={!visibilityState['basics' as VisibilityItemsType]}
      active={activeTabId === 'basics'}
      isMobile={isMobile}
      onActivate={() => onUpdateActiveTabId('basics')}
    />
  )

  return (
    <SideTabsWrapper defaultId={activeTabId}>
      {isMobile
        ? (
            <SideTabs>
              {renderBasics()}
              {orderDraggable.map((id) => {
                const item = ITEMS.find(it => it.id === id)!
                const visibilityKey = item.id as VisibilityItemsType
                return (
                  <StaticTab
                    key={id}
                    id={visibilityKey}
                    label={item.label}
                    icon={item.icon}
                    visible={!visibilityState[visibilityKey]}
                    active={activeTabId === item.id}
                    isMobile={isMobile}
                    onActivate={() => onUpdateActiveTabId(item.id)}
                    onToggleVisibility={() => onToggleVisibility(visibilityKey)}
                  />
                )
              })}
            </SideTabs>
          )
        : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <SideTabs>
                {renderBasics()}
                <Droppable droppableId={DROPPABLE_ID} direction="horizontal">
                  {droppable => (
                    <div
                      ref={droppable.innerRef}
                      {...droppable.droppableProps}
                      className="flex flex-row gap-3"
                    >
                      {orderDraggable.map((id, index) => {
                        const item = ITEMS.find(it => it.id === id)!
                        const visibilityKey = item.id as VisibilityItemsType
                        return (
                          <Draggable key={id} draggableId={id} index={index}>
                            {(draggable, snapshot) => (
                              <SortableTab
                                id={visibilityKey}
                                label={item.label}
                                icon={item.icon}
                                visible={!visibilityState[visibilityKey]}
                                active={activeTabId === item.id}
                                isDragging={snapshot.isDragging}
                                innerRef={draggable.innerRef}
                                draggableProps={draggable.draggableProps}
                                dragHandleProps={draggable.dragHandleProps}
                                onActivate={() => onUpdateActiveTabId(item.id)}
                                onToggleVisibility={() => onToggleVisibility(visibilityKey)}
                              />
                            )}
                          </Draggable>
                        )
                      })}
                      {droppable.placeholder}
                    </div>
                  )}
                </Droppable>
              </SideTabs>
            </DragDropContext>
          )}

      <ViewPort items={ITEMS} fill={fill} stroke={stroke} />

      {isMobile && (
        <MobileSortDrawer
          open={sortDialogOpen}
          order={order}
          onOpenChange={onSortDialogOpenChange}
          onConfirm={onUpdateOrder}
        />
      )}
    </SideTabsWrapper>
  )
}
