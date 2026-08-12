import type { DropResult } from '@hello-pangea/dnd'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { useCallback } from 'react'
import { Accordion } from '@/components/ui/accordion'
import useResumeStore from '@/store/resume/form'
import { ITEMS } from '../../const'
import { SectionRow } from './section-row'

interface AccordionEditorProps {
  order: ORDERType[]
  visibilityState: Record<string, boolean>
  onActivate: (id: ORDERType) => void
  onUpdateOrder: (order: ORDERType[]) => void
  onToggleVisibility: (id: VisibilityItemsType) => void
}

const DROPPABLE_ID = 'resume-edit-panel-sections'

/**
 * 桌面编辑区主体：单开折叠列表 + 竖向拖拽排序。
 * - 基本信息固定置顶（不可拖、无显隐开关）；其余模块可拖拽排序。
 * - 单开：展开集合 openSections 提升到 store（本地 UI 态，不写 Automerge），
 *   由 useSectionToggleBroadcast 广播给协作方，实现展开/收起双向同步。
 * - 展开自动置为 activeTab（store 内联动）并触发 onActivate 滚动渲染区；收起清空集合。
 * - 排序/显隐均复用 store 动作，天然参与协作同步。
 */
export function AccordionEditor({
  order,
  visibilityState,
  onActivate,
  onUpdateOrder,
  onToggleVisibility,
}: AccordionEditorProps) {
  const orderDraggable = order.filter(id => id !== 'basics')
  const basicsItem = ITEMS.find(item => item.id === 'basics')!

  const openSections = useResumeStore(state => state.openSections)
  const setSectionOpen = useResumeStore(state => state.setSectionOpen)

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index)
      return
    const next = [...orderDraggable]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onUpdateOrder(['basics', ...next])
  }, [orderDraggable, onUpdateOrder])

  // 单开受控：展开新项会由 store 原子替换旧项；空字符串表示收起当前项
  const handleValueChange = useCallback((next: string) => {
    const current = openSections[0]
    if (next) {
      const nextSection = next as ORDERType
      setSectionOpen(nextSection, true)
      onActivate(nextSection)
    }
    else if (current) {
      setSectionOpen(current, false)
    }
  }, [openSections, setSectionOpen, onActivate])

  return (
    <Accordion
      type="single"
      collapsible
      value={openSections[0] ?? ''}
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
