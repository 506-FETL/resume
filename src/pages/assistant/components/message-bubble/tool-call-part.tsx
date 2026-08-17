import type { AiMessagePart } from '@/lib/ai/types'
import { Loader2, PanelRight, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getToolCategoryIcon } from '@/lib/utils/tool-icons'
import useAssistantStore from '../../store'
import { retryToolCall } from '../../tool-retry'
import { TOOL_CANVAS_META } from '../../utils'
import { computeFieldDiff } from '../diff/compute-field-diff'
import { DiffStat } from '../diff/diff-view'
import { SECTION_LABELS } from '../diff/field-labels'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
}

function statOf(part: ToolCallPart): { additions: number, deletions: number } | null {
  const result = part.result
  const sectionKey = (part.args as { sectionKey?: string } | undefined)?.sectionKey
  if (!sectionKey || !result || typeof result !== 'object' || !('before' in result) || !('after' in result))
    return null
  const r = result as { before: unknown, after: unknown }
  const changes = computeFieldDiff(SECTION_LABELS[sectionKey] ?? sectionKey, r.before, r.after)
  const additions = changes.filter(c => c.kind !== 'removed').length
  const deletions = changes.filter(c => c.kind !== 'added').length
  if (additions > 0 || deletions > 0)
    return { additions, deletions }
  return null
}

export function ToolCallPartGroup({ calls }: ToolCallPartProps) {
  const targetTab = calls
    .map(c => TOOL_CANVAS_META[c.toolName]?.targetTab)
    .find(Boolean)

  return (
    <div className="flex flex-col gap-1">
      {/* ChatGPT/Codex 式工具活动轨迹：左侧引导线 + 逐行「图标 + 动作 + 增删统计」 */}
      <div className="flex flex-col gap-0.5 border-l-2 border-border/70 pl-3">
        {calls.map((c) => {
          const meta = TOOL_CANVAS_META[c.toolName]
          const label = meta?.label ?? c.toolName
          const pending = c.state === 'call' || c.state === 'awaiting-confirm'
          const stat = statOf(c)
          return (
            <div key={c.toolCallId} className="flex items-center gap-2 py-0.5 text-sm">
              <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                {pending
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : getToolCategoryIcon(meta?.iconCategory ?? 'general', { showBackground: false, size: 16 })}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground/80">{label}</span>
              {stat && <DiffStat additions={stat.additions} deletions={stat.deletions} />}
              {c.state === 'cancelled' && <span className="text-xs text-muted-foreground">已取消</span>}
              {c.state === 'error' && (
                <>
                  <span className="text-xs text-rose-500">失败</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-xs text-rose-500 hover:text-rose-600"
                    onClick={() => retryToolCall(c.toolCallId)}
                  >
                    <RotateCw className="size-3.5" />
                    重试
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>
      {targetTab && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-fit gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => {
            useAssistantStore.setState({ canvasOpen: true, canvasMobileOpen: true })
            useAssistantStore.getState().requestCanvasTab(targetTab)
          }}
        >
          <PanelRight className="size-3.5" />
          在画布中查看
        </Button>
      )}
    </div>
  )
}
