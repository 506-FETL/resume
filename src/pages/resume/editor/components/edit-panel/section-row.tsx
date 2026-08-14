import type { PointerEventHandler, ReactNode } from 'react'
import type { ORDERType } from '@/lib/schema'
import { ChevronDown, GripVertical } from 'lucide-react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
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
  onDragHandlePointerDown?: PointerEventHandler<HTMLSpanElement>
  onKeyboardMove?: (direction: -1 | 1) => void
  onToggleVisibility?: () => void
}

/**
 * 编辑区单行：卡片式折叠项。表头为「拖拽柄 + 图标 + 名称 + 展开箭头 + 显隐开关」，
 * 点表头就地展开该模块表单。直接组合 radix 原语以获得整行布局控制（不改 ui/accordion 原语）。
 *
 * 拖拽中由外层 Motion Reorder.Item 提升层级，并省略 AccordionContent；
 * 展开态被拖动时只移动紧凑表头卡片，落下后从 store 恢复表单内容。
 */
export function SectionRow({
  id,
  label,
  icon,
  content,
  visible,
  fixed = false,
  isDragging = false,
  onDragHandlePointerDown,
  onKeyboardMove,
  onToggleVisibility,
}: SectionRowProps) {
  return (
    <div
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
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    onDragHandlePointerDown?.(event)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault()
                      event.stopPropagation()
                      onKeyboardMove?.(event.key === 'ArrowUp' ? -1 : 1)
                    }
                  }}
                  className="touch-none shrink-0 cursor-grab rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                  aria-label={`拖动「${label}」模块调整顺序`}
                  aria-keyshortcuts="ArrowUp ArrowDown"
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
}
