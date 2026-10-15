import type { JobApplication, TrackerSortBy } from '../../types'
import { Archive, ArrowDown, ArrowRight, ArrowUp, Bell, Building2, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { AnimatePresence, useIsPresent, useReducedMotion } from 'motion/react'
import { memo, useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { PresenceTableRow } from '@/components/motion/presence-item'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_DOT_CLASSES, APPLICATION_STATUS_ORDER, NEXT_ACTION_TONE_CLASSES } from '../../const'
import { isTrackerAccountScopeError } from '../../lib/account-scope'
import useTrackerStore from '../../store'
import { getDaysInStage, getNextActionBadge, getTrackerErrorMessage, getTrackerNextAction } from '../../utils'
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
  const isDaysActive = field === 'status' && sortBy === 'days'
  const reduceMotion = useReducedMotion()
  return (
    <th
      aria-sort={isActive || isDaysActive ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
      className={cn('px-4 py-3.5 text-left font-medium', field === 'company' && 'w-[26%]', field === 'status' && 'w-[14%]', field === 'updated' && 'w-[13%]')}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive && 'text-foreground',
        )}
        style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s` }}
      >
        {label}
        {isActive && (
          sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        )}
      </button>
      {field === 'status' && (
        <button
          type="button"
          onClick={() => onSort('days')}
          className={cn('mt-1 flex items-center gap-1 rounded-sm text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', isDaysActive && 'text-foreground')}
          aria-label="按未更新时间排序"
        >
          未更新时间
          {isDaysActive && (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      )}
    </th>
  )
}

interface JobTableRowProps {
  job: JobApplication
  index: number
  layoutKey: { jobs: JobApplication[], isSelectMode: boolean }
  onStatusChange: (job: JobApplication, status: JobApplication['status']) => void
  onArchive: (job: JobApplication) => void
  onDelete: (job: JobApplication) => void
}

const JobTableRow = memo(({ job, index, layoutKey, onStatusChange, onArchive, onDelete }: JobTableRowProps) => {
  const { isSelectMode, isSelected, toggleSelect, openJobDrawer } = useTrackerStore(useShallow(state => ({
    isSelectMode: state.isSelectMode,
    isSelected: state.selectedIds.has(job.id),
    toggleSelect: state.toggleSelect,
    openJobDrawer: state.openJobDrawer,
  })))
  const reduce = useReducedMotion()
  const isPresent = useIsPresent()
  const statusConfig = APPLICATION_STATUS_CONFIG[job.status]
  const nextAction = getTrackerNextAction(job)
  const nextActionBadge = getNextActionBadge(job)
  const daysInStage = getDaysInStage(job)
  const handleRowClick = () => {
    if (!isPresent)
      return
    if (isSelectMode)
      toggleSelect(job.id)
    else openJobDrawer(job)
  }
  return (
    <PresenceTableRow
      key={job.id}
      layout={reduce ? false : 'position'}
      layoutDependency={layoutKey}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : DURATION.fast, delay: 0, ease: EASE.in } }}
      transition={reduce ? { duration: 0 } : { duration: DURATION.base, delay: staggerDelay(Math.min(index, 8)), ease: EASE.out, layout: SPRING.layout }}
      onClick={handleRowClick}
      className={cn(
        'group cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/35',
        isSelected && 'bg-primary/5',
      )}
      style={{ transitionDuration: `${reduce ? 0 : DURATION.fast}s` }}
    >
      {isSelectMode && (
        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            aria-label={`选择 ${job.company} ${job.position}`}
            onCheckedChange={() => isPresent && toggleSelect(job.id)}
          />
        </td>
      )}
      <td className="px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CompanyLogo logo={job.company_logo} company={job.company} icon={Building2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium text-muted-foreground">{job.company}</span>
              {job.archived && (
                <span className="shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground">已归档</span>
              )}
            </div>
            <button
              type="button"
              className="mt-1 block w-full rounded-sm text-left font-semibold leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isSelectMode ? `选择 ${job.position}` : `查看 ${job.company} ${job.position}`}
              onClick={(event) => {
                event.stopPropagation()
                handleRowClick()
              }}
            >
              <span className="line-clamp-2 break-words">{job.position}</span>
            </button>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-xs">
        <p className="truncate">{job.location || '地点未填写'}</p>
        <p className="mt-1 truncate text-muted-foreground">{job.salary || '薪资未填写'}</p>
      </td>
      <td className="px-4 py-4 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className={cn('size-1.5 shrink-0 rounded-full', APPLICATION_STATUS_DOT_CLASSES[job.status])} />
          {statusConfig.label}
        </span>
        <p className="mt-1 text-muted-foreground">{daysInStage === 0 ? '今天更新' : `${daysInStage} 天未更新`}</p>
      </td>
      <td className="px-4 py-4 text-xs">
        <p className={cn('line-clamp-2 break-words leading-5', !job.next_action && 'text-muted-foreground')}>{job.next_action || '未设置下一步'}</p>
        {nextActionBadge && (
          <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium', NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone])}>
            <Bell className="size-2.5" />
            {nextActionBadge.label}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{formatDate(job.updated_at)}</td>
      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {nextAction.targetStatus && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => isPresent && onStatusChange(job, nextAction.targetStatus!)}
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
            <DropdownMenuContent inert={!isPresent} aria-hidden={!isPresent || undefined} align="end" onClick={e => e.stopPropagation()}>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => isPresent && openJobDrawer(job)}>
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
                  <DropdownMenuItem key={status} onClick={() => isPresent && onStatusChange(job, status)}>
                    标记为
                    {APPLICATION_STATUS_CONFIG[status].label}
                  </DropdownMenuItem>
                ))}
                {job.status !== 'rejected' && (
                  <DropdownMenuItem onClick={() => isPresent && onStatusChange(job, 'rejected')}>
                    终止流程
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => isPresent && onArchive(job)}>
                <Archive data-icon="inline-start" />
                {job.archived ? '取消归档' : '归档'}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => isPresent && onDelete(job)}>
                <Trash2 data-icon="inline-start" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </PresenceTableRow>
  )
})

export function JobTable({ jobs }: JobTableProps) {
  const {
    isSelectMode,
    selectedIds,
    selectAll,
    changeJobStatus,
    saveJobFields,
    deleteJob,
    sortBy,
    sortDir,
    setSort,
  } = useTrackerStore(useShallow(state => ({
    isSelectMode: state.isSelectMode,
    selectedIds: state.selectedIds,
    selectAll: state.selectAll,
    changeJobStatus: state.changeJobStatus,
    saveJobFields: state.saveJobFields,
    deleteJob: state.deleteJob,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    setSort: state.setSort,
  })))
  const [pendingDeleteJob, setPendingDeleteJob] = useState<JobApplication | null>(null)
  const [pendingStatus, setPendingStatus] = useState<{ job: JobApplication, status: JobApplication['status'] } | null>(null)

  const allSelected = jobs.length > 0 && jobs.every(job => selectedIds.has(job.id))
  const layoutKey = useMemo(() => ({ jobs, isSelectMode }), [jobs, isSelectMode])

  const commitStatus = useCallback(async (id: string, newStatus: JobApplication['status']) => {
    try {
      await changeJobStatus(id, newStatus)
    }
    catch (error) {
      if (isTrackerAccountScopeError(error))
        return
      toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
    }
  }, [changeJobStatus])

  const handleStatusChange = useCallback(async (job: JobApplication, newStatus: JobApplication['status']) => {
    if (job.status === newStatus)
      return
    if (newStatus === 'offer' || newStatus === 'rejected') {
      setPendingStatus({ job, status: newStatus })
      return
    }
    await commitStatus(job.id, newStatus)
  }, [commitStatus])

  const handleDelete = async (job: JobApplication) => {
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

  const handleArchive = useCallback(async (job: JobApplication) => {
    const next = !job.archived
    try {
      await saveJobFields(job.id, { archived: next })
    }
    catch (error) {
      if (isTrackerAccountScopeError(error))
        return
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
  }, [saveJobFields])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="scrollbar-thin-subtle min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1000px] table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr>
              {isSelectMode && (
                <th className="w-12 px-4 py-3.5 text-left">
                  <Checkbox
                    checked={allSelected}
                    aria-label="选择全部"
                    onCheckedChange={() => selectAll()}
                  />
                </th>
              )}
              <SortableHead field="company" label="公司 / 职位" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <th className="w-[14%] px-4 py-3.5 text-left font-medium">地点 / 薪资</th>
              <SortableHead field="status" label="当前阶段" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <th className="w-[18%] px-4 py-3.5 text-left font-medium">下一步跟进</th>
              <SortableHead field="updated" label="最近更新" sortBy={sortBy} sortDir={sortDir} onSort={setSort} />
              <th className="w-[15%] px-4 py-3.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {jobs.map((job, index) => (
                <JobTableRow
                  key={job.id}
                  job={job}
                  index={index}
                  layoutKey={layoutKey}
                  onStatusChange={handleStatusChange}
                  onArchive={handleArchive}
                  onDelete={setPendingDeleteJob}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <AlertDialog open={pendingStatus !== null} onOpenChange={open => !open && setPendingStatus(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认变更流程？</AlertDialogTitle>
            <AlertDialogDescription>
              将把该职位标记为「
              {pendingStatus ? APPLICATION_STATUS_CONFIG[pendingStatus.status].label : ''}
              」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!pendingStatus)
                return
              commitStatus(pendingStatus.job.id, pendingStatus.status)
              setPendingStatus(null)
            }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
