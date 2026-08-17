import type { CanvasChange, CanvasModel } from '../../../types'
import type { FormDataMap } from '@/store/resume'
import { ChevronRight, Crosshair, RefreshCw, RotateCcw, Undo2 } from 'lucide-react'
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
import { retryToolCall } from '../../../tool-retry'
import { DiffStat } from '../../diff/diff-view'
import { FieldDiffView } from '../../diff/field-diff-view'

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

// 将重做状态写回对应 tool-call part，清除 undone 标记（与 markChangeUndone 对称）
async function markChangeRedone(toolCallId: string): Promise<void> {
  const { messages, replaceMessage } = useAssistantStore.getState()
  const owner = messages.find(m => m.parts.some(p => p.type === 'tool-call' && p.toolCallId === toolCallId))
  if (!owner)
    return
  const parts = owner.parts.map((p) => {
    if (p.type === 'tool-call' && p.toolCallId === toolCallId) {
      const { undone: _undone, ...rest } = p as typeof p & { undone?: boolean }
      return rest
    }
    return p
  })
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
  const requestCanvasTab = useAssistantStore(s => s.requestCanvasTab)
  const [undoneIds, setUndoneIds] = useState<Set<string>>(() => new Set())
  const [redoneIds, setRedoneIds] = useState<Set<string>>(() => new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingRetryId, setPendingRetryId] = useState<string | null>(null)
  const [undoAllPending, setUndoAllPending] = useState(false)
  const [reapplyPending, setReapplyPending] = useState(false)
  const [retryAllPending, setRetryAllPending] = useState(false)

  // 统一的"是否已撤销"判断：本地状态优先（redoneIds > undoneIds），否则用持久化标记
  const isUndoneItem = (change: CanvasChange): boolean =>
    (undoneIds.has(change.id) || !!change.undone) && !redoneIds.has(change.id)

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

  const handleRedo = async (change: CanvasChange) => {
    const detail = change.detail
    if (!change.undo || detail?.kind !== 'diff')
      return
    const currentId = useCurrentResumeStore.getState().resumeId
    if (!currentId) {
      toast.error('请先在编辑器打开该简历再重做')
      return
    }
    setPendingId(change.id)
    try {
      await applyResumeFieldToDocument(currentId, change.undo.sectionKey as keyof FormDataMap, detail.after as Record<string, unknown>)
      setRedoneIds(prev => new Set(prev).add(change.id))
      await markChangeRedone(change.id)
      bumpCanvasRefresh()
      toast.success('已重新应用该修改')
    }
    catch (error) {
      toast.error('重做失败', { description: error instanceof Error ? error.message : '请稍后重试' })
    }
    finally {
      setPendingId(null)
    }
  }

  const handleUndoAll = async () => {
    const currentId = useCurrentResumeStore.getState().resumeId
    if (!currentId) {
      toast.error('请先在编辑器打开该简历再撤销')
      return
    }
    setUndoAllPending(true)
    const targets = model.writes.filter(c => c.undo && c.state === 'result' && !isUndoneItem(c))
    let successCount = 0
    try {
      for (const change of targets) {
        try {
          await applyResumeFieldToDocument(currentId, change.undo!.sectionKey as keyof FormDataMap, change.undo!.before as Record<string, unknown>)
          setUndoneIds(prev => new Set(prev).add(change.id))
          await markChangeUndone(change.id)
          successCount++
        }
        catch {
          // 跳过单条失败，继续其他
        }
      }
      if (successCount > 0) {
        bumpCanvasRefresh()
        toast.success(`已撤销 ${successCount} 项修改`)
      }
    }
    finally {
      setUndoAllPending(false)
    }
  }

  const handleReapplyAll = async () => {
    const currentId = useCurrentResumeStore.getState().resumeId
    if (!currentId) {
      toast.error('请先在编辑器打开该简历再重做')
      return
    }
    setReapplyPending(true)
    const targets = model.writes.filter(c => isUndoneItem(c) && c.undo && c.detail?.kind === 'diff')
    let successCount = 0
    try {
      for (const change of targets) {
        const detail = change.detail
        if (detail?.kind !== 'diff')
          continue
        try {
          await applyResumeFieldToDocument(currentId, change.undo!.sectionKey as keyof FormDataMap, detail.after as Record<string, unknown>)
          setRedoneIds(prev => new Set(prev).add(change.id))
          await markChangeRedone(change.id)
          successCount++
        }
        catch {
          // 跳过单条失败，继续其他
        }
      }
      if (successCount > 0) {
        bumpCanvasRefresh()
        toast.success(`已重新应用 ${successCount} 项修改`)
      }
    }
    finally {
      setReapplyPending(false)
    }
  }

  const handleRetry = async (change: CanvasChange) => {
    setPendingRetryId(change.id)
    try {
      await retryToolCall(change.id)
    }
    finally {
      setPendingRetryId(null)
    }
  }

  const handleRetryAll = async () => {
    setRetryAllPending(true)
    const targets = model.writes.filter(c => c.state === 'error')
    try {
      for (const change of targets) {
        await retryToolCall(change.id)
      }
    }
    finally {
      setRetryAllPending(false)
    }
  }

  const handleLocate = (sectionKey: string) => {
    requestCanvasTab('resume')
    const tryScroll = (attempt: number) => {
      const el = document.getElementById(`resume-section-${sectionKey}`)
      if (!el) {
        if (attempt < 3) {
          setTimeout(() => tryScroll(attempt + 1), 150)
        }
        return
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // 临时高亮：用 box-shadow ring（支持 transition 渐变），1.8s 后淡出移除
      const prevBoxShadow = el.style.boxShadow
      const prevBorderRadius = el.style.borderRadius
      const prevTransition = el.style.transition
      el.style.transition = 'box-shadow 0.3s ease'
      el.style.borderRadius = '4px'
      el.style.boxShadow = '0 0 0 2px var(--primary)'
      setTimeout(() => {
        el.style.boxShadow = prevBoxShadow
        setTimeout(() => {
          el.style.borderRadius = prevBorderRadius
          el.style.transition = prevTransition
        }, 300)
      }, 1800)
    }
    requestAnimationFrame(() => tryScroll(0))
  }

  if (model.writes.length === 0) {
    return <Empty><EmptyHeader><EmptyTitle>本轮暂无变更</EmptyTitle></EmptyHeader></Empty>
  }

  // 顶部操作条显示条件
  const undoableChanges = model.writes.filter(c => c.undo && c.state === 'result' && !isUndoneItem(c))
  const redoableChanges = model.writes.filter(c => isUndoneItem(c) && c.undo && c.detail?.kind === 'diff')
  const errorChanges = model.writes.filter(c => c.state === 'error')
  const showTopBar = undoableChanges.length > 0 || redoableChanges.length > 0 || errorChanges.length > 0

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="flex flex-col gap-2 p-3">
        {/* 顶部批量操作条 */}
        {showTopBar && (
          <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-2">
            {undoableChanges.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={undoAllPending || reapplyPending}
                onClick={handleUndoAll}
              >
                <Undo2 className="size-3.5" />
                {undoAllPending ? '撤销中…' : `全部撤销 (${undoableChanges.length})`}
              </Button>
            )}
            {redoableChanges.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={reapplyPending || undoAllPending}
                onClick={handleReapplyAll}
              >
                <RotateCcw className="size-3.5" />
                {reapplyPending ? '重做中…' : `全部重做 (${redoableChanges.length})`}
              </Button>
            )}
            {errorChanges.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={retryAllPending}
                onClick={handleRetryAll}
              >
                <RefreshCw className="size-3.5" />
                {retryAllPending ? '重试中…' : `重试全部失败 (${errorChanges.length})`}
              </Button>
            )}
          </div>
        )}

        {/* 变更列表 */}
        {model.writes.map((change) => {
          const isUndone = isUndoneItem(change)
          const canUndo = !!change.undo && change.state === 'result' && !isUndone
          const canRedo = isUndone && !!change.undo && change.detail?.kind === 'diff'
          const canRetry = change.state === 'error'
          const canLocate = !!change.undo?.sectionKey
          const showActionRow = canUndo || canRedo || canRetry || canLocate
          const stateBadge = isUndone
            ? <Badge variant="outline">已撤销</Badge>
            : <StateBadge state={change.state} />

          const actionRow = showActionRow
            ? (
                <div className="flex justify-end gap-1 border-t p-2">
                  {canLocate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => handleLocate(change.undo!.sectionKey)}
                    >
                      <Crosshair className="size-3.5" />
                      定位
                    </Button>
                  )}
                  {canRetry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={pendingRetryId === change.id}
                      onClick={() => handleRetry(change)}
                    >
                      <RefreshCw className="size-3.5" />
                      {pendingRetryId === change.id ? '重试中…' : '重试'}
                    </Button>
                  )}
                  {canRedo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={pendingId === change.id}
                      onClick={() => handleRedo(change)}
                    >
                      <RotateCcw className="size-3.5" />
                      {pendingId === change.id ? '重做中…' : '重做'}
                    </Button>
                  )}
                  {canUndo && (
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
                  )}
                </div>
              )
            : null

          // 没有 diff/摘要的变更（如保存/恢复历史版本）：渲染为普通行
          if (!change.detail) {
            return (
              <div key={change.id} className="rounded-lg border bg-background overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-2.5 text-sm">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{change.title}</span>
                    {change.stat && <DiffStat additions={change.stat.additions} deletions={change.stat.deletions} />}
                  </span>
                  {stateBadge}
                </div>
                {actionRow}
              </div>
            )
          }
          return (
            <Collapsible key={change.id} defaultOpen={change.detail.kind === 'diff'} className="rounded-lg border bg-background overflow-hidden">
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
                  ? <FieldDiffView sectionKey={change.undo?.sectionKey ?? ''} before={change.detail.before} after={change.detail.after} />
                  : <p className="text-muted-foreground">{change.detail.text}</p>}
              </CollapsibleContent>
              {actionRow}
            </Collapsible>
          )
        })}
      </div>
    </ScrollArea>
  )
}
