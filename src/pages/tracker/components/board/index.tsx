import type { RefCallback } from 'react'
import type { ApplicationStatus, JobApplication } from '../../types'
import type { CrossListDropResult } from '@/components/ui/cross-list-drag'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import {
  CrossListDragProvider,
  useCrossListContainer,
  useCrossListItem,
} from '@/components/ui/cross-list-drag'
import { updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, BOARD_COLUMNS } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, filterJobs, getTrackerErrorMessage } from '../../utils'
import { ColumnCard } from './column-card'

function BoardJobItem({
  job,
  containerId,
  index,
  reduceMotion,
}: {
  job: JobApplication
  containerId: ApplicationStatus
  index: number
  reduceMotion: boolean | null
}) {
  const { dragging, getDragProps } = useCrossListItem({
    id: job.id,
    containerId,
    index,
  })

  return (
    <motion.div
      {...getDragProps()}
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: dragging ? 0.3 : 1, y: 0 }}
      transition={reduceMotion
        ? { duration: 0 }
        : {
            layout: { type: 'spring', stiffness: 500, damping: 40 },
            opacity: { duration: 0.12 },
            delay: dragging ? 0 : Math.min(index, 8) * 0.03,
          }}
      className="cursor-grab rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing"
    >
      <ColumnCard job={job} />
    </motion.div>
  )
}

function BoardColumnDropArea({
  status,
  jobs,
  highlighted,
  reduceMotion,
}: {
  status: ApplicationStatus
  jobs: JobApplication[]
  highlighted: boolean
  reduceMotion: boolean | null
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const itemIds = useMemo(() => jobs.map(job => job.id), [jobs])
  const { ref: registerContainerRef, active } = useCrossListContainer({
    id: status,
    label: APPLICATION_STATUS_CONFIG[status].label,
    itemIds,
    axis: 'y',
    scrollRef,
  })
  const setContainerRef = useCallback<RefCallback<HTMLDivElement>>((element) => {
    scrollRef.current = element
    registerContainerRef(element)
  }, [registerContainerRef])

  return (
    <div
      ref={setContainerRef}
      role="list"
      aria-label={`${APPLICATION_STATUS_CONFIG[status].label}职位`}
      data-motion-drop-container={status}
      className={cn(
        'scrollbar-gutter-stable scrollbar-thin-subtle flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-b-lg border bg-muted/20 p-2.5 transition-colors',
        active && 'bg-primary/5 ring-1 ring-primary/30',
        highlighted && !active && 'border-primary/40 bg-primary/5',
      )}
    >
      {jobs.length > 0
        ? jobs.map((job, index) => (
            <BoardJobItem
              key={job.id}
              job={job}
              containerId={status}
              index={index}
              reduceMotion={reduceMotion}
            />
          ))
        : (
            <div className="flex min-h-[96px] flex-1 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground/70">
              拖拽职位至此
            </div>
          )}
    </div>
  )
}

function JobOverlay({ job }: { job: JobApplication }) {
  return (
    <div className="rounded-lg shadow-xl ring-1 ring-primary/20">
      <ColumnCard job={job} />
    </div>
  )
}

export default function BoardView() {
  const {
    jobs,
    filterStatus,
    metricFilter,
    searchKeyword,
    showArchived,
    syncJob,
    restoreJobsSnapshot,
    rejectedCollapsed,
    toggleRejectedCollapsed,
  } = useTrackerStore()
  const reduceMotion = useReducedMotion()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [pendingMove, setPendingMove] = useState<{ jobId: string, newStatus: ApplicationStatus } | null>(null)

  const filteredJobs = filterJobs(jobs, null, searchKeyword, showArchived, metricFilter)
  const getJobsByStatus = (status: ApplicationStatus) =>
    filteredJobs.filter(job => job.status === status)

  const scrollToColumn = useCallback((status: string) => {
    const container = scrollContainerRef.current
    const columnEl = columnRefs.current.get(status)
    if (!container || !columnEl)
      return

    const containerRect = container.getBoundingClientRect()
    const columnRect = columnEl.getBoundingClientRect()
    if (columnRect.left < containerRect.left || columnRect.right > containerRect.right) {
      const scrollLeft = columnEl.offsetLeft - container.offsetLeft - 16
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (filterStatus && BOARD_COLUMNS.some(column => column.status === filterStatus))
      requestAnimationFrame(() => scrollToColumn(filterStatus))
  }, [filterStatus, scrollToColumn])

  const commitMove = (jobId: string, newStatus: ApplicationStatus) => {
    const previousState = useTrackerStore.getState()
    const currentJob = previousState.jobs.find(job => job.id === jobId)
    if (!currentJob || currentJob.status === newStatus)
      return

    const updatedStageDetails = autoCompleteStages(currentJob.status, newStatus, currentJob.stage_details, true)
    const optimisticJob = {
      ...currentJob,
      status: newStatus,
      stage_details: updatedStageDetails,
      activities: appendStatusChangeActivity(currentJob, newStatus),
    }
    syncJob(optimisticJob)

    updateCompany(jobId, optimisticJob)
      .then(savedJob => syncJob(savedJob))
      .catch((error) => {
        restoreJobsSnapshot({
          jobs: previousState.jobs,
          selectedJob: previousState.selectedJob,
        })
        toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
      })
  }

  const handleDrop = ({ itemId, destinationId }: CrossListDropResult) => {
    const newStatus = destinationId as ApplicationStatus
    const currentJob = useTrackerStore.getState().jobs.find(job => job.id === itemId)
    if (!currentJob || currentJob.status === newStatus)
      return

    if (newStatus === 'offer' || newStatus === 'rejected') {
      setPendingMove({ jobId: itemId, newStatus })
      return
    }
    commitMove(itemId, newStatus)
  }

  const scrollAreas = [{
    ref: scrollContainerRef,
    axis: 'x' as const,
    threshold: 120,
    maxStep: 24,
  }]
  const isColumnHighlighted = (status: ApplicationStatus) =>
    filterStatus !== null && filterStatus === status

  return (
    <>
      <CrossListDragProvider
        onDrop={handleDrop}
        scrollAreas={scrollAreas}
        renderOverlay={(jobId) => {
          const job = useTrackerStore.getState().jobs.find(item => item.id === jobId)
          return job ? <JobOverlay job={job} /> : null
        }}
      >
        <div
          ref={scrollContainerRef}
          className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-auto overflow-y-hidden overscroll-x-contain"
        >
          <div className="flex min-h-0 flex-1 items-stretch gap-3 pb-2 xl:gap-4">
            {BOARD_COLUMNS.map((column) => {
              const columnJobs = getJobsByStatus(column.status)
              const highlighted = isColumnHighlighted(column.status)
              const config = APPLICATION_STATUS_CONFIG[column.status]
              const isRejectedColumn = column.status === 'rejected'
              const collapsed = isRejectedColumn && rejectedCollapsed
              return (
                <div
                  key={column.status}
                  ref={(element) => {
                    if (element)
                      columnRefs.current.set(column.status, element)
                    else
                      columnRefs.current.delete(column.status)
                  }}
                  className={cn(
                    'flex h-full min-h-0 flex-col',
                    collapsed
                      ? 'w-[48px] shrink-0'
                      : 'min-w-[240px] flex-1 basis-0 xl:min-w-[280px] 2xl:min-w-[320px]',
                  )}
                >
                  {collapsed
                    ? (
                        <button
                          type="button"
                          aria-expanded={false}
                          onClick={toggleRejectedCollapsed}
                          title={`${column.label}（${columnJobs.length}）· 点击展开`}
                          className="flex h-full min-h-0 w-full flex-col items-center gap-2 rounded-lg border bg-muted/30 py-3 text-muted-foreground transition-colors hover:bg-muted/50"
                        >
                          <ChevronRight className="size-4 shrink-0" />
                          <span className={cn('size-2 shrink-0 rounded-full', config.bgColor)} />
                          <span className="[writing-mode:vertical-rl] text-sm font-semibold tracking-wide">{column.label}</span>
                          <Badge variant="secondary" className="mt-1">{columnJobs.length}</Badge>
                        </button>
                      )
                    : (
                        <>
                          <div className={cn(
                            'flex items-center justify-between gap-2 rounded-t-lg border border-b-0 bg-muted/30 px-3 py-2.5',
                            highlighted && 'border-primary/40 bg-primary/5',
                          )}
                          >
                            {isRejectedColumn
                              ? (
                                  <button
                                    type="button"
                                    aria-expanded={true}
                                    onClick={toggleRejectedCollapsed}
                                    className="flex min-w-0 cursor-pointer items-center gap-2"
                                  >
                                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className={cn('size-2 shrink-0 rounded-full', config.bgColor)} />
                                    <h3 className="truncate text-sm font-semibold">{column.label}</h3>
                                  </button>
                                )
                              : (
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className={cn('size-2 shrink-0 rounded-full', config.bgColor)} />
                                    <h3 className="truncate text-sm font-semibold">{column.label}</h3>
                                  </div>
                                )}
                            <Badge variant={highlighted ? 'default' : 'secondary'}>
                              {columnJobs.length}
                            </Badge>
                          </div>

                          <BoardColumnDropArea
                            status={column.status}
                            jobs={columnJobs}
                            highlighted={highlighted}
                            reduceMotion={reduceMotion}
                          />
                        </>
                      )}
                </div>
              )
            })}
          </div>
        </div>
      </CrossListDragProvider>

      <AlertDialog open={pendingMove !== null} onOpenChange={open => !open && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMove?.newStatus === 'offer' ? '确认移动到「已录用」？' : '确认移动到「已终止」？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove?.newStatus === 'offer'
                ? '将把该职位标记为已录用。'
                : '将把该职位标记为终止流程，可在「已终止」列或筛选下查看。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMove(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove)
                  commitMove(pendingMove.jobId, pendingMove.newStatus)
                setPendingMove(null)
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
