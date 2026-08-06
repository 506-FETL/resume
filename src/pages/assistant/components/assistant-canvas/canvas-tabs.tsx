import type { CanvasModel } from '../../types'
import { FileText, GitBranch, ListChecks, Pin, PinOff, Table2 } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import useAssistantStore from '../../store'

export function CanvasTabs({ model }: { model: CanvasModel }) {
  const { canvasTabPinned, setCanvasTabPinned } = useAssistantStore()

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b p-2">
      {/* 内容自适应宽度、左对齐，保持 shadcn 胶囊样式 */}
      <TabsList className="w-fit">
        <TabsTrigger value="resume" className="gap-1.5">
          <FileText className="size-4" />
          简历预览
        </TabsTrigger>
        {model.touchedBoard && (
          <TabsTrigger value="board" className="gap-1.5">
            <Table2 className="size-4" />
            求职看板
          </TabsTrigger>
        )}
        {model.touchedVersion && (
          <TabsTrigger value="version" className="gap-1.5">
            <GitBranch className="size-4" />
            历史版本
          </TabsTrigger>
        )}
        {model.hasWrites && (
          <TabsTrigger value="changes" className="gap-1.5">
            <ListChecks className="size-4" />
            变更记录
          </TabsTrigger>
        )}
      </TabsList>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={canvasTabPinned ? '取消固定当前标签' : '固定当前标签'}
            aria-pressed={canvasTabPinned}
            onClick={() => setCanvasTabPinned(!canvasTabPinned)}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
              canvasTabPinned
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {canvasTabPinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {canvasTabPinned ? '已固定：切换会话不自动跳走' : '固定当前标签'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
