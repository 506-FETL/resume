import type { JobApplication } from '../../types'
import { Archive, Building2, MapPin, MoreVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { archiveCompany, deleteCompany, updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, getTrackerErrorMessage } from '../../utils'
import { CompanyLogo } from '../company-logo'

interface JobCardProps {
  job: JobApplication
}

export function JobCard({ job }: JobCardProps) {
  const { isSelectMode, selectedIds, toggleSelect, openJobDrawer, syncJob, restoreJobsSnapshot, removeJobs } = useTrackerStore()
  const [pendingDelete, setPendingDelete] = useState(false)
  const isSelected = selectedIds.has(job.id)
  const statusConfig = APPLICATION_STATUS_CONFIG[job.status]

  const handleClick = () => {
    if (isSelectMode)
      toggleSelect(job.id)
    else openJobDrawer(job)
  }

  const handleDelete = async () => {
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
    if (newStatus === job.status)
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
          'cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-muted/30',
          isSelected && 'border-primary bg-primary/5',
          job.archived && 'opacity-60',
        )}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CompanyLogo logo={job.company_logo} company={job.company} icon={Building2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{job.position}</p>
                <p className="truncate text-xs text-muted-foreground">{job.company}</p>
              </div>
              <Badge className={cn('shrink-0 rounded-full border-0 px-2 py-0.5 text-[11px]', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{job.location || '—'}</span>
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
                      className="size-4"
                      onClick={e => e.stopPropagation()}
                      onCheckedChange={() => toggleSelect(job.id)}
                    />
                  )
                : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => openJobDrawer(job)}>
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
                        <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(true)}>
                          <Trash2 data-icon="inline-start" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
            </div>
          </div>
        </div>
      </Card>
      <AlertDialog open={pendingDelete} onOpenChange={open => !open && setPendingDelete(false)}>
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
