import type { CanvasChange, CanvasModel } from '../../../types'
import type { FormDataMap } from '@/store/resume'
import { ChevronRight, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { updateMessage } from '@/lib/supabase/ai'
import { applyResumeFieldToDocument, useCurrentResumeStore } from '@/store/resume'
import useAssistantStore from '../../../store'
import { DiffStat, DiffView } from '../../diff/diff-view'

// 将撤销状态写回对应 tool-call part（内存态 + DB 持久化），刷新后仍显示「已撤销」
async function markChangeUndone(toolCallId: string): Promise<void> {
  const { messages, replaceMessage } = useAssistantStore.getState()
  const owner = messages.find(m => m.parts.some(p => p.type === 'tool-call' && p.toolCallId === toolCallId))
  if (!owner)
    return
  const parts = owner.parts.map(p =>
    p.type === 'tool-call' && p.toolCallId === toolCallId ? { ...p, undone: true } : p,
  )
  replaceMessage(owner.id, { ...owner, parts })
  if (owner.id.startsWith('local-') || owner.id === 'streaming')
    return
  try {
    await updateMessage(owner.id, { parts })
  }
  catch {
    // 持久化失败静默处理，内存态已更新
  }
}

function StateBadge({ state }: { state: CanvasChange['state'] }) {
  if (state === 'cancelled')
    return <Badge variant="outline">已取消</Badge>
  if (state === 'error')
    return <Badge variant="destructive">失败</Badge>
  return <Badge variant="secondary">已应用</Badge>
}

export default function ChangeLog({ model }: { model: CanvasModel }) {
  const bumpCanvasRefresh = useAssistantStore(s => s.bumpCanvasRefresh)
  const [undoneIds, setUndoneIds] = useState<Set<string>>(() => new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleUndo = async (change: CanvasChange) => {
    if (!change.undo)
      return
    const currentId = useCurrentResumeStore.getState().resumeId
    if (!currentId) {
      toast.error('请先在编辑器打开该简历再撤销')
      return
    }
    setPendingId(change.id)
    try {
      await applyResumeFieldToDocument(currentId, change.undo.sectionKey as keyof FormDataMap, change.undo.before as Record<string, unknown>)
      setUndoneIds(prev => new Set(prev).add(change.id))
      await markChangeUndone(change.id)
      bumpCanvasRefresh()
      toast.success('已撤销该修改')
    }
    catch (error) {
      toast.error('撤销失败', { description: error instanceof Error ? error.message : '请稍后重试' })
    }
    finally {
      setPendingId(null)
    }
  }

  if (model.writes.length === 0) {
    return <Empty><EmptyHeader><EmptyTitle>本轮暂无变更</EmptyTitle></EmptyHeader></Empty>
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="flex flex-col gap-2 p-3">
        {model.writes.map((change) => {
          const isUndone = undoneIds.has(change.id) || !!change.undone
          const canUndo = !!change.undo && change.state === 'result' && !isUndone
          const stateBadge = isUndone
            ? <Badge variant="outline">已撤销</Badge>
            : <StateBadge state={change.state} />
          // 没有 diff/摘要的变更（如保存/恢复历史版本）：渲染为不可展开的普通行，避免空的折叠面板
          if (!change.detail) {
            return (
              <div key={change.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5 text-sm">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{change.title}</span>
                  {change.stat && <DiffStat additions={change.stat.additions} deletions={change.stat.deletions} />}
                </span>
                {stateBadge}
              </div>
            )
          }
          return (
            <Collapsible key={change.id} defaultOpen={change.detail.kind === 'diff'} className="rounded-lg border bg-background">
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-2.5 text-left text-sm">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <span className="min-w-0 flex-1 truncate font-medium">{change.title}</span>
                  {change.stat && <DiffStat additions={change.stat.additions} deletions={change.stat.deletions} />}
                </span>
                {stateBadge}
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t p-2.5 text-xs">
                {change.detail.kind === 'diff'
                  ? <DiffView before={change.detail.before} after={change.detail.after} />
                  : <p className="text-muted-foreground">{change.detail.text}</p>}
              </CollapsibleContent>
              {canUndo && (
                <div className="flex justify-end border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={pendingId === change.id}
                    onClick={() => handleUndo(change)}
                  >
                    <Undo2 className="size-3.5" />
                    {pendingId === change.id ? '撤销中…' : '撤销'}
                  </Button>
                </div>
              )}
            </Collapsible>
          )
        })}
      </div>
    </ScrollArea>
  )
}
