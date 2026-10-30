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
  isTrackerAccountScopeError,
} from '../../lib/account-scope'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import { filterJobs, getTrackerErrorMessage } from '../../utils'

export default function BatchActions() {
  const {
    jobs,
    isSelectMode,
    selectedIds,
    selectAll,
    exitSelectMode,
    deleteJob,
    changeJobStatus,
    saveJobFields,
    filterStatus,
    metricFilter,
    searchKeyword,
    showArchived,
    focusedOnly,
    filterCompanyId,
    viewMode,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      isSelectMode: state.isSelectMode,
      selectedIds: state.selectedIds,
      selectAll: state.selectAll,
      exitSelectMode: state.exitSelectMode,
      deleteJob: state.deleteJob,
      changeJobStatus: state.changeJobStatus,
      saveJobFields: state.saveJobFields,
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      searchKeyword: state.searchKeyword,
      showArchived: state.showArchived,
      focusedOnly: state.focusedOnly,
      filterCompanyId: state.filterCompanyId,
      viewMode: state.viewMode,
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

  const selectableCount = filterJobs(
    filterCompanyId
      ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
      : jobs,
    viewMode === 'list' ? filterStatus : null,
    searchKeyword,
    showArchived,
    viewMode === 'list' ? metricFilter : null,
    focusedOnly,
  ).length

  const selectedCount = selectedIds.size

  const handleExitSelectMode = () => {
    document
      .getElementById('tracker-batch-toggle')
      ?.focus({ preventScroll: true })

    exitSelectMode()
  }

  const handleDeleteSelectedJobs = async () => {
    const { selectedIds: currentSelectedIds } = useTrackerStore.getState()

    if (currentSelectedIds.size === 0) return

    const ids = new Set(currentSelectedIds)

    try {
      await Promise.all(Array.from(ids).map((id) => deleteJob(id)))
      toast.success(`已删除 ${ids.size} 个职位`)
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      console.error('Failed to delete jobs:', error)
      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const runBatchStatusChange = async (newStatus: ApplicationStatus) => {
    const state = useTrackerStore.getState()
    const scope = getTrackerAccountScope()

    const targets = state.jobs.filter(
      (job) => state.selectedIds.has(job.id) && job.status !== newStatus,
    )

    if (targets.length === 0) return

    try {
      await Promise.all(
        targets.map((job) => changeJobStatus(job.id, newStatus)),
      )

      if (!isTrackerAccountScopeCurrent(scope)) return

      const latest = useTrackerStore.getState()

      const remaining = targets.filter(
        (job) =>
          latest.jobs.find((row) => row.id === job.id)?.status !== newStatus,
      )

      if (remaining.length)
        useTrackerStore.setState({
          selectedIds: new Set(remaining.map((job) => job.id)),
        })
      else handleExitSelectMode()
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('批量更新失败', {
        description: getTrackerErrorMessage(error),
      })
    }
  }

  // 批量改到终态「已结束」需二次确认，与看板拖拽/抽屉单条路径一致
  const handleBatchStatusChange = (newStatus: ApplicationStatus) => {
    if (newStatus === 'rejected' || newStatus === 'offer') {
      setPendingBatchStatus(newStatus)
      setConfirmationCount(selectedCount)
      setBatchStatusOpen(true)

      return
    }

    runBatchStatusChange(newStatus)
  }

  const handleBatchArchive = async () => {
    const state = useTrackerStore.getState()

    const targets = state.jobs.filter(
      (job) => state.selectedIds.has(job.id) && !job.archived,
    )

    if (targets.length === 0) return

    try {
      await Promise.all(
        targets.map((job) => saveJobFields(job.id, { archived: true })),
      )

      handleExitSelectMode()
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('批量归档失败', {
        description: getTrackerErrorMessage(error),
      })
    }
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
              <span className='font-medium'>
                已选
                <span className='mx-1 text-primary'>{selectedCount}</span>/{' '}
                {selectableCount}
              </span>
              <Button
                variant='ghost'
                size='sm'
                className='h-7'
                onClick={selectAll}
              >
                {selectedCount === selectableCount && selectableCount > 0
                  ? '取消全选'
                  : '全选当前筛选'}
              </Button>
              {selectedCount > 0 && (
                <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={statusTriggerRef}
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
                    onClick={() => handleBatchArchive()}
                  >
                    <Archive className='size-3.5' />
                    归档
                  </Button>
                  <Button
                    ref={deleteTriggerRef}
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

                if (pendingBatchStatus) runBatchStatusChange(pendingBatchStatus)
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
                handleDeleteSelectedJobs()
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
