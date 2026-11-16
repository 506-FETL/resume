import { useChangeActions } from './use-change-actions'
import { useChangeDisclosure } from './use-change-disclosure'
import type { CanvasChange, CanvasModel } from '../../../types'
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  RefreshCw,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'
import useAssistantStore from '../../../store'
import { DiffStat } from '../../diff/diff-view'
import { FieldDiffView } from '../../diff/field-diff-view'

function StateBadge({ state }: { state: CanvasChange['state'] }) {
  if (state === 'cancelled') return <Badge variant='outline'>已取消</Badge>
  if (state === 'error') return <Badge variant='destructive'>失败</Badge>
  if (state !== 'result') return <Badge variant='outline'>待完成</Badge>

  return <Badge variant='secondary'>已应用</Badge>
}

export default function ChangeLog({ model }: { model: CanvasModel }) {
  const requestCanvasTab = useAssistantStore((s) => s.requestCanvasTab)
  const reduceMotion = useReducedMotion()

  const {
    running,
    pendingId,
    pendingRetryId,
    undoAllPending,
    reapplyPending,
    retryAllPending,
    isUndoneItem,
    handleUndo,
    handleRedo,
    handleUndoAll,
    handleReapplyAll,
    handleRetry,
    handleRetryAll,
  } = useChangeActions(model)

  const {
    collapsibleIds,
    openIds,
    setCollapsibleOpen,
    allExpanded,
    toggleAll,
  } = useChangeDisclosure(model)

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

      // 用 nearest：仅当目标不在可视区时才滚动最小距离（配合 scroll-margin 让其落在 sticky 标题栏下方），
      // 已在可视区则完全不滚动，避免"移动窗口把内容顶出/遮挡"
      el.scrollIntoView({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })

      // 与简历评论一致的黄色高亮，动画结束后自动移除
      el.classList.remove('resume-locate-highlight')
      // 强制 reflow 以便重复点击同一目标时能重新触发动画
      el.getBoundingClientRect()
      el.classList.add('resume-locate-highlight')

      const clear = () => el.classList.remove('resume-locate-highlight')

      el.addEventListener('animationend', clear, { once: true })
      setTimeout(clear, 2400)
    }

    requestAnimationFrame(() => tryScroll(0))
  }

  if (model.writes.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>本轮暂无变更</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  // 顶部操作条显示条件
  const undoableChanges = model.writes.filter(
    (c) => c.undo && c.state === 'result' && !isUndoneItem(c),
  )

  const redoableChanges = model.writes.filter(
    (c) => isUndoneItem(c) && c.undo && c.detail?.kind === 'diff',
  )

  const errorChanges = model.writes.filter((c) => c.state === 'error')
  const canCollapseAll = collapsibleIds.length > 0

  const showTopBar =
    undoableChanges.length > 0 ||
    redoableChanges.length > 0 ||
    errorChanges.length > 0 ||
    canCollapseAll

  return (
    <ScrollArea className='h-full min-h-0'>
      <div className='flex flex-col gap-2 p-3'>
        {/* 顶部批量操作条 */}
        {showTopBar && (
          <div className='flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-2'>
            {undoableChanges.length > 0 && (
              <Button
                variant='outline'
                size='sm'
                className='h-7 gap-1 px-2 text-xs'
                disabled={running || undoAllPending || reapplyPending}
                onClick={handleUndoAll}
              >
                <Undo2 className='size-3.5' />
                {undoAllPending
                  ? '撤销中…'
                  : `全部撤销 (${undoableChanges.length})`}
              </Button>
            )}
            {redoableChanges.length > 0 && (
              <Button
                variant='outline'
                size='sm'
                className='h-7 gap-1 px-2 text-xs'
                disabled={running || reapplyPending || undoAllPending}
                onClick={handleReapplyAll}
              >
                <RotateCcw className='size-3.5' />
                {reapplyPending
                  ? '重做中…'
                  : `全部重做 (${redoableChanges.length})`}
              </Button>
            )}
            {errorChanges.length > 0 && (
              <Button
                variant='outline'
                size='sm'
                className='h-7 gap-1 px-2 text-xs'
                disabled={running || retryAllPending}
                onClick={handleRetryAll}
              >
                <RefreshCw className='size-3.5' />
                {retryAllPending
                  ? '重试中…'
                  : `重试全部失败 (${errorChanges.length})`}
              </Button>
            )}
            {canCollapseAll && (
              <Button
                variant='ghost'
                size='sm'
                className='ml-auto h-7 gap-1 px-2 text-xs'
                onClick={toggleAll}
              >
                {allExpanded ? (
                  <>
                    <ChevronsDownUp className='size-3.5' />
                    全部折叠
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className='size-3.5' />
                    全部展开
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* 变更列表 */}
        {model.writes.map((change, itemIndex) => {
          const isUndone = isUndoneItem(change)

          const canUndo =
            !!change.undo && change.state === 'result' && !isUndone

          const canRedo =
            isUndone && !!change.undo && change.detail?.kind === 'diff'

          const canRetry = change.state === 'error'
          const canLocate = !!change.undo?.sectionKey
          const showActionRow = canUndo || canRedo || canRetry || canLocate

          const stateBadge = isUndone ? (
            <Badge variant='outline'>已撤销</Badge>
          ) : (
            <StateBadge state={change.state} />
          )

          const actionRow = showActionRow ? (
            <div className='flex justify-end gap-1 border-t p-2'>
              {canLocate && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 gap-1 px-2 text-xs'
                  onClick={() => handleLocate(change.undo!.sectionKey)}
                >
                  <Crosshair className='size-3.5' />
                  定位
                </Button>
              )}
              {canRetry && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 gap-1 px-2 text-xs'
                  disabled={running || pendingRetryId === change.id}
                  onClick={() => handleRetry(change)}
                >
                  <RefreshCw className='size-3.5' />
                  {pendingRetryId === change.id ? '重试中…' : '重试'}
                </Button>
              )}
              {canRedo && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 gap-1 px-2 text-xs'
                  disabled={running || pendingId === change.id}
                  onClick={() => handleRedo(change)}
                >
                  <RotateCcw className='size-3.5' />
                  {pendingId === change.id ? '重做中…' : '重做'}
                </Button>
              )}
              {canUndo && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 gap-1 px-2 text-xs'
                  disabled={running || pendingId === change.id}
                  onClick={() => handleUndo(change)}
                >
                  <Undo2 className='size-3.5' />
                  {pendingId === change.id ? '撤销中…' : '撤销'}
                </Button>
              )}
            </div>
          ) : null

          // 没有 diff/摘要的变更（如保存/恢复历史版本）：渲染为普通行
          const itemNode = !change.detail ? (
            <div className='rounded-lg border bg-background overflow-hidden'>
              <div className='flex items-center justify-between gap-2 p-2.5 text-sm'>
                <span className='flex min-w-0 flex-1 items-center gap-2'>
                  <span className='min-w-0 flex-1 truncate font-medium'>
                    {change.title}
                  </span>
                  {change.stat && (
                    <DiffStat
                      additions={change.stat.additions}
                      deletions={change.stat.deletions}
                    />
                  )}
                </span>
                {stateBadge}
              </div>
              {actionRow}
            </div>
          ) : (
            <Collapsible
              open={openIds.has(change.id)}
              onOpenChange={(open) => setCollapsibleOpen(change.id, open)}
              className='rounded-lg border bg-background overflow-hidden'
            >
              <CollapsibleTrigger className='group flex w-full items-center justify-between gap-2 p-2.5 text-left text-sm'>
                <span className='flex min-w-0 flex-1 items-center gap-2'>
                  <ChevronRight className='size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90' />
                  <span className='min-w-0 flex-1 truncate font-medium'>
                    {change.title}
                  </span>
                  {change.stat && (
                    <DiffStat
                      additions={change.stat.additions}
                      deletions={change.stat.deletions}
                    />
                  )}
                </span>
                {stateBadge}
              </CollapsibleTrigger>
              <CollapsibleContent className='overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up'>
                <div className='border-t p-2.5 text-xs'>
                  {change.detail.kind === 'diff' ? (
                    <FieldDiffView
                      sectionKey={change.undo?.sectionKey ?? ''}
                      before={change.detail.before}
                      after={change.detail.after}
                    />
                  ) : (
                    <p className='text-muted-foreground'>
                      {change.detail.text}
                    </p>
                  )}
                </div>
              </CollapsibleContent>
              {actionRow}
            </Collapsible>
          )

          return (
            <motion.div
              key={change.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                delay: reduceMotion ? 0 : staggerDelay(Math.min(itemIndex, 5)),
              }}
            >
              {itemNode}
            </motion.div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
