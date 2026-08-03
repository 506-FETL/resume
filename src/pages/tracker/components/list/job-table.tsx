import type { JobApplication, TrackerSortBy } from '../../types'
import { Archive, ArrowDown, ArrowRight, ArrowUp, Bell, Building2, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { archiveCompany, deleteCompany, updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER, NEXT_ACTION_TONE_CLASSES } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, getDaysInStage, getNextActionBadge, getTrackerErrorMessage, getTrackerNextAction } from '../../utils'
import { CompanyLogo } from '../company-logo'

interface JobTableProps {
  jobs: JobApplication[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr)
    return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface SortableHeadProps {
  field: TrackerSortBy
  label: string
  sortBy: TrackerSortBy
  sortDir: 'asc' | 'desc'
  onSort: (field: TrackerSortBy) => void
}

function SortableHead({ field, label, sortBy, sortDir, onSort }: SortableHeadProps) {
  const isActive = sortBy === field
  return (
    <th className="px-3 py-2.5 text-left font-medium">
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground',
          isActive && 'text-foreground',
        )}
      >
        {label}
        {isActive && (
          sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        )}
      </button>
    </th>
  )
}

export function JobTable({ jobs }: JobTableProps) {
  const {
    isSelectMode,
    selectedIds,
    toggleSelect,
    selectAll,
    openJobDrawer,
    syncJob,
    restoreJobsSnapshot,
    removeJobs,
    sortBy,
    sortDir,
    setSort,
  } = useTrackerStore()
  const reduce = useReducedMotion()
  const [pendingDeleteJob, setPendingDeleteJob] = useState<JobApplication | null>(null)

  const allSelected = jobs.length > 0 && jobs.every(job => selectedIds.has(job.id))

  const handleStatusChange = async (job: JobApplication, newStatus: JobApplication['status']) => {
    if (job.status === newStatus)
      return
    const previousState = useTrackerStore.getState()
    const updatedStageDetails = autoCompleteStages(job.status, newStatus, job.stage_details, true)
    const optimisticJob = {
      ...job,
      status: newStatus,
      stage_details: updatedStageDetails,
      activities: appendStatusChangeActivity(job, newStatus),
    }

    syncJob(optimisticJob)

    try {
      const savedJob = await updateCompany(job.id, optimisticJob)
      syncJob(savedJob)
    }
    catch (error) {
      restoreJobsSnapshot({
        jobs: previousState.jobs,
        selectedJob: previousState.selectedJob,
      })
      toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleDelete = async (job: JobApplication) => {
    try {
      await deleteCompany(job.id)
      removeJobs([job.id])
      toast.success('已删除')
    }
    catch (error) {
      console.error('Failed to delete job:', error)
      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleArchive = async (job: JobApplication) => {
    const next = !job.archived
    try {
      const savedJob = await archiveCompany(job.id, next)
      syncJob(savedJob)
    }
    catch (error) {
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {isSelectMode && (
                <th className="w-10 px-3 py-2.5 text-left">
                  <Checkbox
                    checked={allSelected}
                    aria-label="选择全部"
                    onCheckedChange={() => selectAll()}
                  />
                </th>
              )}
              <SortableHead field="company" label="公司 / 职位" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <th className="px-3 py-2.5 text-left font-medium">地点</th>
              <th className="px-3 py-2.5 text-left font-medium">薪资</th>
              <SortableHead field="status" label="状态" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <SortableHead field="days" label="停留" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <SortableHead field="updated" label="更新时间" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <th className="px-3 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => {
              const isSelected = selectedIds.has(job.id)
              const statusConfig = APPLICATION_STATUS_CONFIG[job.status]
              const nextAction = getTrackerNextAction(job)
              const nextActionBadge = getNextActionBadge(job)
              const daysInStage = getDaysInStage(job)
              const handleRowClick = () => {
                if (isSelectMode)
                  toggleSelect(job.id)
                else openJobDrawer(job)
              }
              return (
                <motion.tr
                  key={job.id}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(index, 12) * 0.02 }}
                  onClick={handleRowClick}
                  className={cn(
                    'group cursor-pointer border-t transition-colors hover:bg-muted/40',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  {isSelectMode && (
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(job.id)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <CompanyLogo logo={job.company_logo} company={job.company} icon={Building2} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{job.position}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs text-muted-foreground">{job.company}</span>
                          {job.archived && (
                            <span className="shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground">已归档</span>
                          )}
                          {nextActionBadge && (
                            <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium', NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone])}>
                              <Bell className="size-2.5" />
                              {nextActionBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{job.location || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{job.salary || '—'}</td>
                  <td className="px-3 py-2.5">
                    <Badge className={cn('rounded-full border-0 px-2 py-0.5 text-xs font-medium', statusConfig.bgColor, statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{daysInStage === 0 ? '今天' : `${daysInStage}天`}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(job.updated_at)}</td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {nextAction.targetStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleStatusChange(job, nextAction.targetStatus!)}
                        >
                          {nextAction.label}
                          <ArrowRight />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="更多操作">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => openJobDrawer(job)}>
                              查看详情
                            </DropdownMenuItem>
                            {job.job_url && (
                              <DropdownMenuItem asChild>
                                <a href={job.job_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink data-icon="inline-start" />
                                  打开 JD
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            {APPLICATION_STATUS_ORDER.filter(status => status !== job.status).map(status => (
                              <DropdownMenuItem key={status} onClick={() => handleStatusChange(job, status)}>
                                标记为
                                {APPLICATION_STATUS_CONFIG[status].label}
                              </DropdownMenuItem>
                            ))}
                            {job.status !== 'rejected' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job, 'rejected')}>
                                终止流程
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleArchive(job)}>
                            <Archive data-icon="inline-start" />
                            {job.archived ? '取消归档' : '归档'}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setPendingDeleteJob(job)}>
                            <Trash2 data-icon="inline-start" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AlertDialog open={pendingDeleteJob !== null} onOpenChange={open => !open && setPendingDeleteJob(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除职位？</AlertDialogTitle>
            <AlertDialogDescription>
              {`删除后将无法恢复。确定要永久删除「${pendingDeleteJob?.company ?? ''} - ${pendingDeleteJob?.position ?? ''}」吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteJob(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDeleteJob)
                  return
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
