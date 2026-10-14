import type { JobApplication } from '../../types'
import { Archive, Bell, Building2, Link2, MapPin, MoreVertical, Trash2 } from 'lucide-react'
import { useIsPresent, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DURATION } from '@/lib/motion'
import { archiveCompany, deleteCompany, updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_DOT_CLASSES, APPLICATION_STATUS_ORDER, NEXT_ACTION_TONE_CLASSES } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, getDaysInStage, getNextActionBadge, getTrackerErrorMessage, getTrackerMetaSummary } from '../../utils'
import { CompanyLogo } from '../company-logo'

interface JobCardProps {
  job: JobApplication
}

export function JobCard({ job }: JobCardProps) {
  const isPresent = useIsPresent()
  const reduceMotion = useReducedMotion()
  const { isSelectMode, selectedIds, toggleSelect, openJobDrawer, syncJob, restoreJobsSnapshot, removeJobs } = useTrackerStore()
  const [pendingDelete, setPendingDelete] = useState(false)
  const isSelected = selectedIds.has(job.id)
  const statusConfig = APPLICATION_STATUS_CONFIG[job.status]
  const nextActionBadge = getNextActionBadge(job)
  const meta = getTrackerMetaSummary(job)
  const daysInStage = getDaysInStage(job)

  const handleClick = () => {
    if (!isPresent)
      return
    if (isSelectMode)
      toggleSelect(job.id)
    else openJobDrawer(job)
  }

  const handleDelete = async () => {
    if (!isPresent)
      return
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

  const handleArchive = async () => {
    if (!isPresent)
      return
    const next = !job.archived
    try {
      const savedJob = await archiveCompany(job.id, next)
      syncJob(savedJob)
    }
    catch (error) {
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleStatusChange = async (newStatus: JobApplication['status']) => {
    if (!isPresent || newStatus === job.status)
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

  return (
    <>
      <Card
        className={cn(
          'gap-0 cursor-pointer rounded-xl border-border/70 bg-card p-0 shadow-xs transition-colors hover:bg-muted/20',
          isSelected && 'border-primary bg-primary/5',
          job.archived && 'opacity-60',
        )}
        style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s` }}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3 p-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CompanyLogo logo={job.company_logo} company={job.company} icon={Building2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{job.company}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium">
                <span className={cn('size-1.5 rounded-full', APPLICATION_STATUS_DOT_CLASSES[job.status])} />
                {statusConfig.label}
              </span>
            </div>
            <button
              type="button"
              className="mt-1.5 block w-full rounded-sm text-left text-sm font-semibold leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isSelectMode ? `选择 ${job.position}` : `查看 ${job.company} ${job.position}`}
              onClick={(event) => {
                event.stopPropagation()
                handleClick()
              }}
            >
              <span className="line-clamp-2 break-words">{job.position}</span>
            </button>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{job.location || '地点未填写'}</span>
                {job.salary && (
                  <span className="ml-1 truncate">
                    ·
                    {job.salary}
                  </span>
                )}
              </span>
              {isSelectMode
                ? (
                    <Checkbox
                      checked={isSelected}
                      aria-label={`选择 ${job.company} ${job.position}`}
                      className="size-4"
                      onClick={e => e.stopPropagation()}
                      onCheckedChange={() => isPresent && toggleSelect(job.id)}
                    />
                  )
                : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground"
                          aria-label={`更多操作：${job.company} ${job.position}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent inert={!isPresent} aria-hidden={!isPresent || undefined} align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => isPresent && openJobDrawer(job)}>
                            查看详情
                          </DropdownMenuItem>
                          {APPLICATION_STATUS_ORDER.filter(status => status !== job.status).map(status => (
                            <DropdownMenuItem key={status} onClick={() => handleStatusChange(status)}>
                              标记为
                              {APPLICATION_STATUS_CONFIG[status].label}
                            </DropdownMenuItem>
                          ))}
                          {job.status !== 'rejected' && (
                            <DropdownMenuItem onClick={() => handleStatusChange('rejected')}>
                              终止流程
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleArchive()}>
                          <Archive data-icon="inline-start" />
                          {job.archived ? '取消归档' : '归档'}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => isPresent && setPendingDelete(true)}>
                          <Trash2 data-icon="inline-start" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
            </div>
          </div>
        </div>
        <div className="border-t border-border/60 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>下一步跟进</span>
            <span>{daysInStage === 0 ? '今天更新' : `${daysInStage} 天未更新`}</span>
          </div>
          <p className={cn('mt-1 line-clamp-2 break-words text-xs leading-5', !job.next_action && 'text-muted-foreground')}>{job.next_action || '未设置下一步'}</p>
          {(nextActionBadge || meta.activeSubStageLabel || meta.hasJobUrl || job.archived) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
              {nextActionBadge && (
                <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5', NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone])}>
                  <Bell className="size-2.5" />
                  {nextActionBadge.label}
                </span>
              )}
              {meta.activeSubStageLabel && <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">{meta.activeSubStageLabel}</span>}
              {meta.hasJobUrl && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                  <Link2 className="size-2.5" />
                  JD
                </span>
              )}
              {job.archived && <span className="rounded-full border px-1.5 py-0.5 text-muted-foreground">已归档</span>}
            </div>
          )}
        </div>
      </Card>
      <AlertDialog open={isPresent && pendingDelete} onOpenChange={open => !open && setPendingDelete(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除职位？</AlertDialogTitle>
            <AlertDialogDescription>
              {`删除后将无法恢复。确定要永久删除「${job.company} - ${job.position}」吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setPendingDelete(false)
                handleDelete()
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
