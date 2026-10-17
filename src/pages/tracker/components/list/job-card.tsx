import type { JobApplication } from '../../types'
import { Archive, Bell, Building2, MoreVertical, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { memo, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_DOT_CLASSES, APPLICATION_STATUS_ORDER, NEXT_ACTION_TONE_CLASSES } from '../../const'
import { isTrackerAccountScopeError } from '../../lib/account-scope'
import useTrackerStore from '../../store'
import { getNextActionBadge, getTrackerErrorMessage } from '../../utils'
import { CompanyLogo } from '../company-logo'

interface JobCardProps {
  job: JobApplication
}

function JobCardComponent({ job }: JobCardProps) {
  const isPresent = useIsPresent()
  const reduceMotion = useReducedMotion()
  const { isSelectMode, isSelected, toggleSelect, openJobDrawer, changeJobStatus, saveJobFields, deleteJob } = useTrackerStore(useShallow(state => ({
    isSelectMode: state.isSelectMode,
    isSelected: state.selectedIds.has(job.id),
    toggleSelect: state.toggleSelect,
    openJobDrawer: state.openJobDrawer,
    changeJobStatus: state.changeJobStatus,
    saveJobFields: state.saveJobFields,
    deleteJob: state.deleteJob,
  })))
  const [pendingDelete, setPendingDelete] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<JobApplication['status'] | null>(null)
  const statusConfig = APPLICATION_STATUS_CONFIG[job.status]
  const nextActionBadge = getNextActionBadge(job)
  const dueBadge = nextActionBadge?.tone === 'upcoming' ? null : nextActionBadge

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
      await deleteJob(job.id)
      toast.success('已删除')
    }
    catch (error) {
      if (isTrackerAccountScopeError(error))
        return
      console.error('Failed to delete job:', error)
      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleArchive = async () => {
    if (!isPresent)
      return
    try {
      await saveJobFields(job.id, current => ({ archived: !current.archived }))
    }
    catch (error) {
      if (isTrackerAccountScopeError(error))
        return
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const commitStatus = async (newStatus: JobApplication['status']) => {
    try {
      await changeJobStatus(job.id, newStatus)
    }
    catch (error) {
      if (isTrackerAccountScopeError(error))
        return
      toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleStatusChange = async (newStatus: JobApplication['status']) => {
    if (job.status === newStatus || !isPresent)
      return
    if (newStatus === 'offer' || newStatus === 'rejected') {
      setPendingStatus(newStatus)
      return
    }
    await commitStatus(newStatus)
  }

  return (
    <>
      <Card
        className={cn(
          'gap-0 cursor-pointer rounded-xl border border-border/70 bg-card p-0 shadow-xs ring-0 transition-colors hover:bg-muted/20',
          isSelected && 'border-primary bg-primary/5',
          job.archived && 'opacity-60',
        )}
        style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`, transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})` }}
        onClick={handleClick}
      >
        <div className="flex items-start gap-2.5 p-3">
          <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CompanyLogo logo={job.company_logo} company={job.company} icon={Building2} />
          </div>
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 self-stretch rounded-sm py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isSelectMode ? `选择 ${job.company} ${job.position}` : `查看 ${job.company} ${job.position}`}
            onClick={(event) => {
              event.stopPropagation()
              handleClick()
            }}
          >
            <span className="line-clamp-2 break-words text-sm font-semibold leading-5 text-foreground">{job.position}</span>
            <span className="mt-1 flex min-w-0 items-center text-xs leading-4 text-muted-foreground" title={`${job.company} · ${job.location || '地点未填写'}`}>
              <span className="truncate">{job.company}</span>
              <span aria-hidden="true" className="shrink-0 px-1">·</span>
              <span className="max-w-16 shrink-0 truncate">{job.location || '地点未填写'}</span>
            </span>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <div className="-mt-1 -mr-1 flex items-center gap-0.5">
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <span aria-hidden="true" className={cn('size-1.5 rounded-full', APPLICATION_STATUS_DOT_CLASSES[job.status])} />
                {statusConfig.label}
              </span>
              {isSelectMode
                ? (
                    <label className="flex size-9 cursor-pointer items-center justify-center" onClick={event => event.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        aria-label={`选择 ${job.company} ${job.position}`}
                        className="size-4"
                        onCheckedChange={() => isPresent && toggleSelect(job.id)}
                      />
                    </label>
                  )
                : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-9 text-muted-foreground"
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
            <AnimatePresence initial={false}>
              {dueBadge && (
                <motion.span
                  key={dueBadge.tone}
                  className={cn('inline-flex max-w-24 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-4', NEXT_ACTION_TONE_CLASSES[dueBadge.tone])}
                  aria-label={`待跟进：${dueBadge.label}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.out }}
                >
                  <Bell aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">{dueBadge.tone === 'today' ? '今天跟进' : dueBadge.label}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
      <AlertDialog open={pendingStatus !== null} onOpenChange={open => !open && setPendingStatus(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认变更流程？</AlertDialogTitle>
            <AlertDialogDescription>
              将把该职位标记为「
              {pendingStatus ? APPLICATION_STATUS_CONFIG[pendingStatus].label : ''}
              」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!pendingStatus)
                return
              commitStatus(pendingStatus)
              setPendingStatus(null)
            }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isPresent && pendingDelete} onOpenChange={open => !open && setPendingDelete(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除职位？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${job.company} - ${job.position}」将永久删除，无法恢复。`}
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

export const JobCard = memo(JobCardComponent)
