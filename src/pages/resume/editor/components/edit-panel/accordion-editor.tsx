import type { DropResult } from '@hello-pangea/dnd'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Accordion } from '@/components/ui/accordion'
import { ITEMS } from '../../const'
import { SectionRow } from './section-row'

interface AccordionEditorProps {
  activeTabId: ORDERType
  order: ORDERType[]
  visibilityState: Record<string, boolean>
  onActivate: (id: ORDERType) => void
  onUpdateOrder: (order: ORDERType[]) => void
  onToggleVisibility: (id: VisibilityItemsType) => void
}

const DROPPABLE_ID = 'resume-edit-panel-sections'

/**
 * 桌面编辑区主体：多开折叠列表 + 竖向拖拽排序。
 * - 基本信息固定置顶（不可拖、无显隐开关）；其余模块可拖拽排序。
 * - 多开：展开集合 openIds 为本地 UI 态，不参与协作同步；同时刻可展开任意多个。
 * - activeTabId 仍是单值、协作同步、驱动渲染区滚动：展开某模块即 onActivate（切 activeTab + 滚动）；
 *   收起仅移出 openIds，不改 activeTab（不破坏渲染区定位）。
 * - 协作方改 activeTabId → 经 prevActiveRef 检测「值真的变了」才并入 openIds 展开，
 *   避免「本地收起当前 active 项后被自动重新展开」的抖动。
 * - 排序/显隐均复用 store 动作，天然参与协作同步。
 */
export function AccordionEditor({
  activeTabId,
  order,
  visibilityState,
  onActivate,
  onUpdateOrder,
  onToggleVisibility,
}: AccordionEditorProps) {
  const orderDraggable = order.filter(id => id !== 'basics')
  const basicsItem = ITEMS.find(item => item.id === 'basics')!

  // 展开集合：本地 UI 态；初始展开当前 activeTab
  const [openIds, setOpenIds] = useState<ORDERType[]>(() => [activeTabId])

  // activeTabId 真正变化（本地激活或协作方切换）时，确保对应模块展开
  const prevActiveRef = useRef(activeTabId)
  useEffect(() => {
    if (prevActiveRef.current === activeTabId)
      return
    prevActiveRef.current = activeTabId
    setOpenIds(prev => (prev.includes(activeTabId) ? prev : [...prev, activeTabId]))
  }, [activeTabId])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index)
      return
    const next = [...orderDraggable]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onUpdateOrder(['basics', ...next])
  }, [orderDraggable, onUpdateOrder])

  // 多开受控：diff 出新展开项 → onActivate（切 activeTab + 滚动）；收起仅更新 openIds
  const handleValueChange = useCallback((next: string[]) => {
    const added = next.find(id => !openIds.includes(id as ORDERType))
    setOpenIds(next as ORDERType[])
    if (added)
      onActivate(added as ORDERType)
  }, [openIds, onActivate])

  return (
    <Accordion
      type="multiple"
      value={openIds}
      onValueChange={handleValueChange}
      className="flex flex-col gap-2"
    >
      <SectionRow
        id="basics"
        label={basicsItem.label}
        icon={basicsItem.icon}
        content={basicsItem.content}
        visible={!visibilityState.basics}
        fixed
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={DROPPABLE_ID} direction="vertical">
          {droppable => (
            <div
              ref={droppable.innerRef}
              {...droppable.droppableProps}
              className="flex flex-col gap-2"
            >
              {orderDraggable.map((id, index) => {
                const item = ITEMS.find(it => it.id === id)!
                const visibilityKey = item.id as VisibilityItemsType
                return (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(draggable, snapshot) => (
                      <SectionRow
                        id={item.id}
                        label={item.label}
                        icon={item.icon}
                        content={item.content}
                        visible={!visibilityState[visibilityKey]}
                        isDragging={snapshot.isDragging}
                        innerRef={draggable.innerRef}
                        draggableProps={draggable.draggableProps}
                        dragHandleProps={draggable.dragHandleProps}
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
      </DragDropContext>
    </Accordion>
  )
}
