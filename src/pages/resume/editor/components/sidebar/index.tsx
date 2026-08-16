import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { Reorder } from 'motion/react'
import { useMotionReorder } from '@/components/ui/motion-reorder'
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
  const sortableOrder = order.filter(id => id !== 'basics')
  const basicsItem = ITEMS.find(item => item.id === 'basics')!
  const {
    draft,
    setDraft,
    startDragging,
    finishDragging,
    moveByKeyboard,
  } = useMotionReorder({
    values: sortableOrder,
    axis: 'x',
    onCommit: next => onUpdateOrder(['basics', ...next]),
  })

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
    <SideTabsWrapper
      defaultId={activeTabId}
      fillAvailableHeight={isMobile}
      className={isMobile ? 'h-full min-h-0 w-full' : undefined}
    >
      {isMobile
        ? (
            <SideTabs className="shrink-0">
              {renderBasics()}
              {sortableOrder.map((id) => {
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
            <SideTabs>
              {renderBasics()}
              <Reorder.Group
                as="div"
                axis="x"
                values={draft}
                onReorder={setDraft}
                layoutScroll
                className="flex flex-row gap-3"
              >
                {draft.map((id) => {
                  const item = ITEMS.find(it => it.id === id)!
                  const visibilityKey = item.id as VisibilityItemsType
                  return (
                    <SortableTab
                      key={id}
                      id={visibilityKey}
                      label={item.label}
                      icon={item.icon}
                      visible={!visibilityState[visibilityKey]}
                      active={activeTabId === item.id}
                      onActivate={() => onUpdateActiveTabId(item.id)}
                      onToggleVisibility={() => onToggleVisibility(visibilityKey)}
                      onDragStart={startDragging}
                      onDragEnd={finishDragging}
                      onKeyboardMove={moveByKeyboard}
                    />
                  )
                })}
              </Reorder.Group>
            </SideTabs>
          )}

      <ViewPort items={ITEMS} fill={fill} stroke={stroke} scrollable={isMobile} />

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
