import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { ReactNode, Ref } from 'react'
import type { ORDERType } from '@/lib/schema'
import { ChevronDown, GripVertical } from 'lucide-react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { createPortal } from 'react-dom'
import { AccordionContent, AccordionItem } from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SectionRowProps {
  id: ORDERType
  label: string
  icon: ReactNode
  content: ReactNode
  visible: boolean
  /** basics 固定置顶：无拖拽柄、无显隐开关 */
  fixed?: boolean
  isDragging?: boolean
  innerRef?: Ref<HTMLDivElement>
  draggableProps?: DraggableProvidedDraggableProps
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  onToggleVisibility?: () => void
}

/**
 * 编辑区单行：卡片式折叠项。表头为「拖拽柄 + 图标 + 名称 + 展开箭头 + 显隐开关」，
 * 点表头就地展开该模块表单。直接组合 radix 原语以获得整行布局控制（不改 ui/accordion 原语）。
 *
 * 拖拽中：整行 createPortal 到 body（脱离面板滚动容器裁剪、层级正确，复用 sortable-tab 思路），
 * 并省略 AccordionContent —— 展开态被拖动时只拖动紧凑表头卡片，而非整块长表单。
 * 外层 div（承载 innerRef/draggableProps）始终稳定，仅表单 body 在拖拽期间短暂卸载，落下后从 store 重新填充。
 */
export function SectionRow({
  id,
  label,
  icon,
  content,
  visible,
  fixed = false,
  isDragging = false,
  innerRef,
  draggableProps,
  dragHandleProps,
  onToggleVisibility,
}: SectionRowProps) {
  const row = (
    <div
      ref={innerRef}
      {...draggableProps}
      className={cn(
        'rounded-lg border bg-card transition-shadow',
        isDragging && 'shadow-lg ring-1 ring-primary/20',
        !visible && 'opacity-60',
      )}
    >
      <AccordionItem value={id} className="border-b-0">
        <AccordionPrimitive.Header className="flex items-center gap-1.5 px-2.5">
          {!fixed
            ? (
                <span
                  {...dragHandleProps}
                  onPointerDownCapture={e => e.stopPropagation()}
                  className="shrink-0 cursor-grab rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                  aria-label={`拖动「${label}」模块调整顺序`}
                >
                  <GripVertical className="size-4" />
                </span>
              )
            : <span className="w-6 shrink-0" aria-hidden="true" />}

          <AccordionPrimitive.Trigger
            disabled={!visible}
            className="group flex min-w-0 flex-1 items-center gap-2 py-3 text-left text-sm font-medium outline-none transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-100"
          >
            <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
            <span className="truncate">{label}</span>
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </AccordionPrimitive.Trigger>

          {!fixed && onToggleVisibility && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div onPointerDownCapture={e => e.stopPropagation()} className="shrink-0 pl-1">
                  <Switch
                    checked={visible}
                    onCheckedChange={onToggleVisibility}
                    aria-label={visible ? `隐藏「${label}」模块` : `显示「${label}」模块`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">{visible ? '点击隐藏该模块' : '点击显示该模块'}</TooltipContent>
            </Tooltip>
          )}
        </AccordionPrimitive.Header>

        {/* 拖拽时省略内容，仅拖动紧凑表头；落下后表单从 store 重新填充 */}
        {!isDragging && (
          <AccordionContent className="px-3 pb-4">
            {content}
          </AccordionContent>
        )}
      </AccordionItem>
    </div>
  )

  // 拖拽中：portal 到 body，避免被面板滚动容器裁剪、层级压制（复用 sortable-tab 思路）
  if (isDragging && typeof document !== 'undefined')
    return createPortal(row, document.body)

  return row
}
