import { MoreJobs } from '../../../more-jobs'
import { useJobWindow } from '../../../../hooks/use-job-window'
import type { JobApplication } from '../../../../types'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { PresenceTableRow } from '@/components/motion/presence-item'
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
import { Checkbox } from '@/components/ui/checkbox'
import { DURATION, EASE } from '@/lib/motion'
import { APPLICATION_STATUS_CONFIG } from '../../../../const'
import { isTrackerAccountScopeError } from '../../../../lib/account-scope'
import useTrackerStore, { getTrackerConflictAction } from '../../../../store'
import { getTrackerErrorMessage } from '../../../../utils'
import { CompanyGroupTitle } from '../company-group-title'
import { SortableHead } from '../sortable-head'
import { JobTableRow } from '../job-table-row'

interface JobTableProps {
  jobs: JobApplication[]
  groupByCompany?: boolean
}

export function JobTable({ jobs, groupByCompany = false }: JobTableProps) {
  const reduceMotion = useReducedMotion()

  const {
    isSelectMode,
    selectedIds,
    scopeComplete,
    loading,
    selectAll,
    changeJobStatus,
    saveJobFields,
    deleteJob,
    sortBy,
    sortDir,
    setSort,
  } = useTrackerStore(
    useShallow((state) => ({
      isSelectMode: state.isSelectMode,
      selectedIds: state.selectedIds,
      scopeComplete: state.scopeComplete,
      loading: state.loading,
      selectAll: state.selectAll,
      changeJobStatus: state.changeJobStatus,
      saveJobFields: state.saveJobFields,
      deleteJob: state.deleteJob,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      setSort: state.setSort,
    })),
  )

  const [pendingDeleteJob, setPendingDeleteJob] =
    useState<JobApplication | null>(null)

  const [pendingStatus, setPendingStatus] = useState<{
    job: JobApplication
    status: JobApplication['status']
  } | null>(null)

  const { rows, ...page } = useJobWindow(jobs)

  const allSelected =
    scopeComplete &&
    jobs.length > 0 &&
    jobs.every((job) => selectedIds.has(job.id))

  const layoutKey = useMemo(
    () => ({ jobs: rows, isSelectMode }),
    [rows, isSelectMode],
  )

  const commitStatus = useCallback(
    async (id: string, newStatus: JobApplication['status']) => {
      try {
        await changeJobStatus(id, newStatus)
      } catch (error) {
        if (isTrackerAccountScopeError(error)) return

        toast.error('更新状态失败', {
          description: getTrackerErrorMessage(error),
          action: getTrackerConflictAction(error),
        })
      }
    },
    [changeJobStatus],
  )

  const handleStatusChange = useCallback(
    async (job: JobApplication, newStatus: JobApplication['status']) => {
      if (job.status === newStatus) return
      if (newStatus === 'offer' || newStatus === 'rejected') {
        setPendingStatus({ job, status: newStatus })

        return
      }

      await commitStatus(job.id, newStatus)
    },
    [commitStatus],
  )

  const handleDelete = async (job: JobApplication) => {
    try {
      await deleteJob(job.id)
      toast.success('已删除')
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      console.error('Failed to delete job:', error)
      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleArchive = useCallback(
    async (job: JobApplication) => {
      const next = !job.archived

      try {
        await saveJobFields(job.id, { archived: next })
      } catch (error) {
        if (isTrackerAccountScopeError(error)) return

        toast.error('操作失败', { description: getTrackerErrorMessage(error) })
      }
    },
    [saveJobFields],
  )

  return (
    <div className='@container/jobs flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
      <div className='scrollbar-thin-subtle min-h-0 flex-1 overflow-auto'>
        <table className='w-full min-w-[420px] table-fixed text-sm'>
          <thead className='sticky top-0 z-10 bg-muted text-xs text-muted-foreground'>
            <tr>
              {isSelectMode && (
                <th className='w-12 px-4 py-3.5 text-left'>
                  <Checkbox
                    checked={allSelected}
                    aria-label='选择全部'
                    disabled={loading}
                    onCheckedChange={() =>
                      selectAll().catch((error) => {
                        if (!isTrackerAccountScopeError(error))
                          toast.error(getTrackerErrorMessage(error))
                      })
                    }
                  />
                </th>
              )}
              <SortableHead
                field='company'
                label='公司 / 职位'
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setSort}
              />
              <th className='hidden w-[14%] px-3 py-3 text-left font-medium @min-[880px]/jobs:table-cell'>
                地点 / 薪资
              </th>
              <SortableHead
                field='status'
                label='当前阶段'
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setSort}
              />
              <th className='hidden w-[24%] px-3 py-3 text-left font-medium @min-[680px]/jobs:table-cell @min-[880px]/jobs:w-[20%]'>
                下一步跟进
              </th>
              <SortableHead
                field='updated'
                label='最近更新'
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setSort}
              />
              <th className='w-16 px-3 py-3 text-right font-medium @min-[680px]/jobs:w-[18%]'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='relative'>
            <AnimatePresence initial={false} mode='popLayout'>
              {rows.flatMap((job, index) => [
                ...(groupByCompany &&
                jobs[index - 1]?.tracker_company_id !== job.tracker_company_id
                  ? [
                      <PresenceTableRow
                        key={`company-${job.tracker_company_id}`}
                        layout={reduceMotion ? false : 'position'}
                        layoutDependency={layoutKey}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{
                          opacity: 0,
                          transition: {
                            duration: reduceMotion ? 0 : DURATION.fast,
                            ease: EASE.out,
                          },
                        }}
                        transition={{
                          duration: reduceMotion ? 0 : DURATION.base,
                          ease: EASE.out,
                          layout: reduceMotion
                            ? { duration: 0 }
                            : {
                                type: 'tween',
                                duration: DURATION.base,
                                ease: EASE.out,
                              },
                        }}
                        className='border-t bg-muted/40'
                      >
                        <td
                          colSpan={isSelectMode ? 7 : 6}
                          className='px-4 py-3'
                        >
                          <CompanyGroupTitle job={job} />
                        </td>
                      </PresenceTableRow>,
                    ]
                  : []),
                <JobTableRow
                  key={job.id}
                  job={job}
                  index={index}
                  layoutKey={layoutKey}
                  onStatusChange={handleStatusChange}
                  onArchive={handleArchive}
                  onDelete={setPendingDeleteJob}
                />,
              ])}
            </AnimatePresence>
          </tbody>
        </table>
        <MoreJobs {...page} />
      </div>
      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
      >
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>确认变更流程？</AlertDialogTitle>
            <AlertDialogDescription>
              将把该职位标记为「
              {pendingStatus
                ? APPLICATION_STATUS_CONFIG[pendingStatus.status].label
                : ''}
              」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingStatus) return

                commitStatus(pendingStatus.job.id, pendingStatus.status)
                setPendingStatus(null)
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingDeleteJob !== null}
        onOpenChange={(open) => !open && setPendingDeleteJob(null)}
      >
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除职位？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${pendingDeleteJob?.company ?? ''} - ${pendingDeleteJob?.position ?? ''}」将永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteJob(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                if (!pendingDeleteJob) return

                const job = pendingDeleteJob

                setPendingDeleteJob(null)
                handleDelete(job)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
