import { useActivityTimeline } from './use-activity-timeline'
import { TimelineEntries } from './timeline-entries'
import type { JobApplication } from '../../../types'
import { ListChecks, Plus, Trash2 } from 'lucide-react'
import AnimatedContent from '@/components/motion/animated-content'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DURATION, EASE } from '@/lib/motion'

interface ActivityTimelineProps {
  job: JobApplication
}

export default function ActivityTimeline({ job }: ActivityTimelineProps) {
  const model = useActivityTimeline(job)

  const {
    reduce,
    draft,
    setDraft,
    saving,
    pendingDeleteActivity,
    deleteOpen,
    setDeleteOpen,
    selectMode,
    selectedIds,
    pendingBatchDelete,
    setPendingBatchDelete,
    batchDeleteCount,
    setBatchDeleteCount,
    sectionRef,
    deleteTriggerRef,
    deletingConfirmedRef,
    sorted,
    handleAdd,
    handleDelete,
    enterSelectMode,
    exitSelectMode,
    allSelected,
    toggleSelectAll,
    handleBatchDelete,
    restoreDeleteFocus,
  } = model

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label='跟进记录'
      className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden outline-none [@media(max-height:640px)]:overflow-visible'
    >
      <div className='flex shrink-0 items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <h3 className='text-sm font-semibold'>跟进记录</h3>
          <span className='text-xs text-muted-foreground'>
            {job.activities.length} 条
          </span>
        </div>
        {sorted.length > 0 &&
          (selectMode ? (
            <div className='flex items-center gap-3'>
              <label className='flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground'>
                <Checkbox
                  checked={allSelected}
                  disabled={saving}
                  onCheckedChange={toggleSelectAll}
                  aria-label='全选'
                />
                全选
              </label>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs'
                disabled={saving}
                onClick={exitSelectMode}
              >
                退出
              </Button>
            </div>
          ) : (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1.5 px-2 text-xs'
              disabled={saving}
              onClick={enterSelectMode}
            >
              <ListChecks className='size-3.5' />
              批量
            </Button>
          ))}
      </div>

      <div className='flex shrink-0 gap-2'>
        <Input
          value={draft}
          placeholder='记一条进展'
          className='min-w-0 flex-1'
          disabled={saving || selectMode}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd()
          }}
        />
        <Button
          size='sm'
          className='h-9 shrink-0'
          disabled={!draft.trim() || saving || selectMode}
          onClick={handleAdd}
        >
          <Plus className='size-3.5' />
          添加
        </Button>
      </div>

      <div
        role='region'
        aria-label='跟进记录列表'
        tabIndex={0}
        className='scrollbar-thin-subtle flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [@media(max-height:640px)]:overflow-visible'
      >
        <AnimatedContent
          animationKey={sorted.length === 0 ? 'empty' : 'activities'}
          className='flex shrink-0 grow flex-col'
        >
          {sorted.length === 0 ? (
            <p className='flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground'>
              暂无跟进记录
            </p>
          ) : (
            <TimelineEntries model={model} />
          )}
        </AnimatedContent>
      </div>

      {selectMode && (
        <div className='flex shrink-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm [@media(max-height:640px)]:sticky [@media(max-height:640px)]:bottom-0'>
          <span className='text-xs text-muted-foreground'>
            已选 {selectedIds.size} 条
          </span>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='sm'
              className='h-8'
              disabled={saving}
              onClick={exitSelectMode}
            >
              取消
            </Button>
            <Button
              variant='destructive'
              size='sm'
              className='h-8'
              disabled={saving || selectedIds.size === 0}
              onClick={(event) => {
                deleteTriggerRef.current = event.currentTarget
                deletingConfirmedRef.current = false
                setBatchDeleteCount(selectedIds.size)
                setPendingBatchDelete(true)
              }}
            >
              <Trash2 className='size-3.5' />
              删除所选
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          size='sm'
          className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto break-words'
          style={{
            animationDuration: `${reduce ? 0 : deleteOpen || pendingBatchDelete ? DURATION.base : DURATION.fast}s`,
            animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
          onCloseAutoFocus={restoreDeleteFocus}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${pendingDeleteActivity?.label ?? '该记录'}」将永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingBatchDelete}
        onOpenChange={(open) => !open && setPendingBatchDelete(false)}
      >
        <AlertDialogContent
          size='sm'
          className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto break-words'
          style={{
            animationDuration: `${reduce ? 0 : deleteOpen || pendingBatchDelete ? DURATION.base : DURATION.fast}s`,
            animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
          onCloseAutoFocus={restoreDeleteFocus}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {`选中的 ${batchDeleteCount} 条记录将永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              onClick={() => setPendingBatchDelete(false)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleBatchDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
