import type { ReactNode } from 'react'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { Accordion } from '@/components/ui/accordion'
import {
  autoScrollAtEdge,
  findScrollableAncestor,
  MOTION_REORDER_TRANSITION,
  useMotionReorder,
} from '@/components/ui/motion-reorder'
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

function SortableSectionRow({
  id,
  label,
  icon,
  content,
  visible,
  onToggleVisibility,
  onDragStart,
  onDragEnd,
  onKeyboardMove,
}: {
  id: ORDERType
  label: string
  icon: ReactNode
  content: ReactNode
  visible: boolean
  onToggleVisibility: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onKeyboardMove: (id: ORDERType, direction: -1 | 1) => void
}) {
  const dragControls = useDragControls()
  const reduceMotion = useReducedMotion()
  const itemRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

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
      onDrag={(_event, info) => {
        autoScrollAtEdge(findScrollableAncestor(itemRef.current, 'y'), info.point, 'y')
      }}
      whileDrag={reduceMotion
        ? { zIndex: 10 }
        : {
            scale: 1.01,
            boxShadow: '0 12px 28px rgb(0 0 0 / 0.14)',
            zIndex: 10,
          }}
      transition={MOTION_REORDER_TRANSITION}
      className="relative"
    >
      <SectionRow
        id={id}
        label={label}
        icon={icon}
        content={content}
        visible={visible}
        isDragging={isDragging}
        onDragHandlePointerDown={event => dragControls.start(event)}
        onKeyboardMove={direction => onKeyboardMove(id, direction)}
        onToggleVisibility={onToggleVisibility}
      />
    </Reorder.Item>
  )
}

/**
 * 桌面编辑区主体：单开折叠列表 + Motion 竖向排序。
 * 基本信息固定置顶；拖动过程只更新本地草稿，落下后一次性同步到简历 store。
 */
export function AccordionEditor({
  order,
  visibilityState,
  onActivate,
  onUpdateOrder,
  onToggleVisibility,
}: AccordionEditorProps) {
  const sortableOrder = order.filter(id => id !== 'basics')
  const basicsItem = ITEMS.find(item => item.id === 'basics')!
  const openSections = useResumeStore(state => state.openSections)
  const setSectionOpen = useResumeStore(state => state.setSectionOpen)
  const {
    draft,
    setDraft,
    startDragging,
    finishDragging,
    moveByKeyboard,
  } = useMotionReorder({
    values: sortableOrder,
    axis: 'y',
    onCommit: next => onUpdateOrder(['basics', ...next]),
  })

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

      <Reorder.Group
        as="div"
        axis="y"
        values={draft}
        onReorder={setDraft}
        layoutScroll
        className="flex flex-col gap-2"
      >
        {draft.map((id) => {
          const item = ITEMS.find(it => it.id === id)!
          const visibilityKey = item.id as VisibilityItemsType
          return (
            <SortableSectionRow
              key={id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              content={item.content}
              visible={!visibilityState[visibilityKey]}
              onToggleVisibility={() => onToggleVisibility(visibilityKey)}
              onDragStart={startDragging}
              onDragEnd={finishDragging}
              onKeyboardMove={(itemId, direction) => {
                moveByKeyboard(itemId as Exclude<ORDERType, 'basics'>, direction)
              }}
            />
          )
        })}
      </Reorder.Group>
    </Accordion>
  )
}
