import { useBatchWrites } from './use-batch-writes'
import type { ApplicationStatus } from '../../types'
import { Archive, ArrowRightLeft, Trash2, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
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
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
} from '../../const'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../lib/account-scope'
import useTrackerStore from '../../store'
import { getTrackerErrorMessage } from '../../utils'

export default function BatchActions({
  selectableCount,
}: {
  selectableCount: number
}) {
  const { isSelectMode, selectedIds, selectAll, exitSelectMode } =
    useTrackerStore(
      useShallow((state) => ({
        isSelectMode: state.isSelectMode,
        selectedIds: state.selectedIds,
        selectAll: state.selectAll,
        exitSelectMode: state.exitSelectMode,
      })),
    )

  const reduce = useReducedMotion()
  const statusTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)

  const [pendingBatchStatus, setPendingBatchStatus] =
    useState<ApplicationStatus | null>(null)

  const [batchStatusOpen, setBatchStatusOpen] = useState(false)
  const [confirmationCount, setConfirmationCount] = useState(0)
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false)

  const [selectingAll, setSelectingAll] = useState(false)
  const selectedCount = selectedIds.size

  const handleSelectAll = async () => {
    const scope = getTrackerAccountScope()

    setSelectingAll(true)

    try {
      await selectAll()
    } catch (error) {
      if (isTrackerAccountScopeCurrent(scope))
        toast.error(getTrackerErrorMessage(error))
    } finally {
      setSelectingAll(false)
    }
  }

  const handleExitSelectMode = () => {
    document
      .getElementById('tracker-batch-toggle')
      ?.focus({ preventScroll: true })

    exitSelectMode()
  }

  const { apply, busy } = useBatchWrites(handleExitSelectMode)

  // 批量改到终态「已结束」需二次确认，与看板拖拽/抽屉单条路径一致
  const handleBatchStatusChange = (newStatus: ApplicationStatus) => {
    if (newStatus === 'rejected' || newStatus === 'offer') {
      setPendingBatchStatus(newStatus)
      setConfirmationCount(selectedCount)
      setBatchStatusOpen(true)

      return
    }

    apply(newStatus)
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {isSelectMode && (
          <PresenceDiv
            key='batch-actions'
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{
              opacity: 0,
              height: 0,
              transition: {
                duration: reduce ? 0 : DURATION.fast,
                ease: EASE.in,
              },
            }}
            transition={{
              duration: reduce ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            className='overflow-hidden'
          >
            <div
              className={cn(
                'mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm',
                selectedCount > 0 && 'border-primary/40 bg-primary/5',
              )}
            >
              <span aria-live='polite' className='font-medium'>
                {busy ? '正在处理' : '已选'}
                <span className='mx-1 text-primary'>{selectedCount}</span>/{' '}
                {selectableCount}
              </span>
              <Button
                variant='secondary'
                size='sm'
                className='h-7'
                disabled={selectingAll || busy}
                onClick={handleSelectAll}
              >
                {selectingAll
                  ? '正在全选…'
                  : selectedCount === selectableCount && selectableCount > 0
                    ? '取消全选'
                    : '全选'}
              </Button>
              {selectedCount > 0 && (
                <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={statusTriggerRef}
                        disabled={busy}
                        variant='outline'
                        size='sm'
                        className='h-7 gap-1'
                      >
                        <ArrowRightLeft className='size-3.5' />
                        改状态
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      {[
                        ...APPLICATION_STATUS_ORDER,
                        'rejected' as ApplicationStatus,
                      ].map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleBatchStatusChange(status)}
                        >
                          标记为
                          {APPLICATION_STATUS_CONFIG[status].label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-7 gap-1'
                    disabled={busy}
                    onClick={() => apply('archive')}
                  >
                    <Archive className='size-3.5' />
                    归档
                  </Button>
                  <Button
                    ref={deleteTriggerRef}
                    disabled={busy}
                    variant='destructive'
                    size='sm'
                    className='h-7'
                    onClick={() => {
                      setConfirmationCount(selectedCount)
                      setPendingBatchDelete(true)
                    }}
                  >
                    <Trash2 />
                    删除选中
                  </Button>
                </div>
              )}
              <Button
                variant='ghost'
                size='sm'
                className={cn('h-7', selectedCount > 0 ? '' : 'ml-auto')}
                onClick={handleExitSelectMode}
              >
                <X />
                退出
              </Button>
            </div>
          </PresenceDiv>
        )}
      </AnimatePresence>
      <AlertDialog open={batchStatusOpen} onOpenChange={setBatchStatusOpen}>
        <AlertDialogContent
          className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto'
          onCloseAutoFocus={(event) => {
            const target = useTrackerStore.getState().isSelectMode
              ? statusTriggerRef.current
              : document.getElementById('tracker-batch-toggle')

            if (target?.isConnected) {
              event.preventDefault()
              target.focus({ preventScroll: true })
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量变更流程？</AlertDialogTitle>
            <AlertDialogDescription>
              将把选中的 {confirmationCount} 个职位标记为「
              {pendingBatchStatus
                ? APPLICATION_STATUS_CONFIG[pendingBatchStatus].label
                : ''}
              」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBatchStatusOpen(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                setBatchStatusOpen(false)

                if (pendingBatchStatus) apply(pendingBatchStatus)
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingBatchDelete}
        onOpenChange={(open) => !open && setPendingBatchDelete(false)}
      >
        <AlertDialogContent
          className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto'
          onCloseAutoFocus={(event) => {
            const target = useTrackerStore.getState().isSelectMode
              ? deleteTriggerRef.current
              : document.getElementById('tracker-batch-toggle')

            if (target?.isConnected) {
              event.preventDefault()
              target.focus({ preventScroll: true })
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除选中的职位？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除当前选中的 {confirmationCount} 个职位，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBatchDelete(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                setPendingBatchDelete(false)
                apply('delete')
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
