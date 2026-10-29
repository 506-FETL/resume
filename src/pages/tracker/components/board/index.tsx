import type { RefCallback } from 'react'
import type { ApplicationStatus, JobApplication } from '../../types'
import type { CrossListDropResult } from '@/components/ui/cross-list-drag'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CrossListDragProvider,
  useCrossListContainer,
  useCrossListItem,
} from '@/components/ui/cross-list-drag'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_DOT_CLASSES,
  BOARD_COLUMNS,
  TRACKER_SEARCH_INPUT_ID,
} from '../../const'
import { isTrackerAccountScopeError } from '../../lib/account-scope'
import useTrackerStore, { getTrackerConflictAction } from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import {
  filterJobs,
  getTrackerErrorMessage,
  resolveTrackerMetricStatus,
} from '../../utils'
import { ColumnCard } from './column-card'

function BoardJobItem({
  job,
  containerId,
  index,
  reduceMotion,
  layoutItems,
}: {
  job: JobApplication
  containerId: ApplicationStatus
  index: number
  reduceMotion: boolean | null
  layoutItems: JobApplication[]
}) {
  const { dragging, getDragProps } = useCrossListItem({
    id: job.id,
    containerId,
    index,
  })

  return (
    <motion.div
      {...getDragProps()}
      layout={reduceMotion ? false : 'position'}
      layoutDependency={layoutItems}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: dragging ? 0.3 : 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              layout: SPRING.layout,
              opacity: { duration: DURATION.fast, ease: EASE.out },
              y: {
                duration: DURATION.base,
                ease: EASE.out,
                delay: staggerDelay(Math.min(index, 8)),
              },
            }
      }
      className='shrink-0 cursor-grab rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing'
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
  const itemIds = useMemo(() => jobs.map((job) => job.id), [jobs])

  const { ref: registerContainerRef, active } = useCrossListContainer({
    id: status,
    label: APPLICATION_STATUS_CONFIG[status].label,
    itemIds,
    axis: 'y',
    scrollRef,
  })

  const setContainerRef = useCallback<RefCallback<HTMLDivElement>>(
    (element) => {
      scrollRef.current = element
      registerContainerRef(element)
    },
    [registerContainerRef],
  )

  return (
    <div
      ref={setContainerRef}
      role='list'
      aria-label={`${APPLICATION_STATUS_CONFIG[status].label}职位`}
      data-motion-drop-container={status}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-b-lg px-2 pt-1 pb-2 transition-colors [scrollbar-width:thin]',
        active && 'bg-primary/5 ring-1 ring-primary/30',
        highlighted && !active && 'bg-primary/5',
      )}
      style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
    >
      {jobs.length > 0 ? (
        jobs.map((job, index) => (
          <BoardJobItem
            key={job.id}
            job={job}
            containerId={status}
            index={index}
            reduceMotion={reduceMotion}
            layoutItems={jobs}
          />
        ))
      ) : (
        <div
          className={cn(
            'flex min-h-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed border-border/70 px-3 text-xs text-muted-foreground',
            active && 'border-primary/50 bg-primary/5 text-primary',
          )}
        >
          拖入此列
        </div>
      )}
    </div>
  )
}

function JobOverlay({ job }: { job: JobApplication }) {
  return (
    <div className='rounded-lg shadow-xl ring-1 ring-primary/20'>
      <ColumnCard job={job} />
    </div>
  )
}

function BoardView() {
  const {
    jobs,
    filterStatus,
    metricFilter,
    searchKeyword,
    showArchived,
    filterCompanyId,
    focusedOnly,
    changeJobStatus,
    rejectedCollapsed,
    toggleRejectedCollapsed,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      searchKeyword: state.searchKeyword,
      showArchived: state.showArchived,
      filterCompanyId: state.filterCompanyId,
      focusedOnly: state.focusedOnly,
      changeJobStatus: state.changeJobStatus,
      rejectedCollapsed: state.rejectedCollapsed,
      toggleRejectedCollapsed: state.toggleRejectedCollapsed,
    })),
  )

  const reduceMotion = useReducedMotion()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const columnElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingMoveJobIdRef = useRef<string | null>(null)
  const restoreColumnFocusRef = useRef(false)

  const setColumnToggleRef = useCallback(
    (element: HTMLButtonElement | null) => {
      if (!element || !restoreColumnFocusRef.current) return

      restoreColumnFocusRef.current = false
      element.focus({ preventScroll: true })
    },
    [],
  )

  const handleToggleRejected = () => {
    restoreColumnFocusRef.current = true
    toggleRejectedCollapsed()
  }

  const focusCancel = useCallback<RefCallback<HTMLButtonElement>>((element) => {
    // ref 在隐藏背景的副作用前挂载，确保焦点先进入确认框。
    element?.focus({ preventScroll: true })
  }, [])

  const [pendingMove, setPendingMove] = useState<{
    jobId: string
    newStatus: ApplicationStatus
  } | null>(null)

  const scopedJobs = useMemo(
    () =>
      filterJobs(
        filterCompanyId
          ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
          : jobs,
        null,
        searchKeyword,
        showArchived,
        null,
        focusedOnly,
      ),
    [jobs, searchKeyword, showArchived, filterCompanyId, focusedOnly],
  )

  const groupedJobs = useMemo(() => {
    const groups = Object.fromEntries(
      BOARD_COLUMNS.map((column) => [column.status, [] as JobApplication[]]),
    ) as Record<ApplicationStatus, JobApplication[]>

    for (const job of scopedJobs) groups[job.status].push(job)

    return groups
  }, [scopedJobs])

  const metricStatus = useMemo(
    () => resolveTrackerMetricStatus(scopedJobs, metricFilter),
    [scopedJobs, metricFilter],
  )

  const highlightedStatus = filterStatus ?? metricStatus

  const scrollToColumn = useCallback(
    (status: string) => {
      const container = scrollContainerRef.current
      const columnEl = columnElementsRef.current.get(status)

      if (!container || !columnEl) return

      // 使用布局尺寸，避免折叠展开的 Motion transform 影响定位范围。
      const columnLeft = columnEl.offsetLeft - container.offsetLeft
      const columnRight = columnLeft + columnEl.offsetWidth

      if (
        columnLeft < container.scrollLeft ||
        columnRight > container.scrollLeft + container.clientWidth
      ) {
        container.scrollTo({
          left: Math.max(0, columnLeft - 12),
          behavior: reduceMotion ? 'auto' : 'smooth',
        })
      }
    },
    [reduceMotion],
  )

  useEffect(() => {
    if (
      highlightedStatus === 'rejected' &&
      useTrackerStore.getState().rejectedCollapsed
    )
      useTrackerStore.getState().toggleRejectedCollapsed()
  }, [highlightedStatus])

  useEffect(() => {
    if (
      !highlightedStatus ||
      !BOARD_COLUMNS.some((column) => column.status === highlightedStatus)
    )
      return

    const frame = requestAnimationFrame(() => scrollToColumn(highlightedStatus))

    return () => cancelAnimationFrame(frame)
  }, [highlightedStatus, scrollToColumn, rejectedCollapsed])

  const commitMove = (jobId: string, newStatus: ApplicationStatus) => {
    changeJobStatus(jobId, newStatus).catch((error) => {
      if (!isTrackerAccountScopeError(error))
        toast.error('更新状态失败', {
          description: getTrackerErrorMessage(error),
          action: getTrackerConflictAction(error),
        })
    })
  }

  const handleDrop = ({ itemId, destinationId }: CrossListDropResult) => {
    const newStatus = destinationId as ApplicationStatus

    const currentJob = useTrackerStore
      .getState()
      .jobs.find((job) => job.id === itemId)

    if (!currentJob || currentJob.status === newStatus) return

    if (newStatus === 'offer' || newStatus === 'rejected') {
      pendingMoveJobIdRef.current = itemId
      setPendingMove({ jobId: itemId, newStatus })

      return
    }

    commitMove(itemId, newStatus)
  }

  const scrollAreas = [
    {
      ref: scrollContainerRef,
      axis: 'x' as const,
      threshold: 120,
      maxStep: 24,
    },
  ]

  const isColumnHighlighted = (status: ApplicationStatus) =>
    highlightedStatus === status

  return (
    <>
      <CrossListDragProvider
        onDrop={handleDrop}
        scrollAreas={scrollAreas}
        renderOverlay={(jobId) => {
          const job = useTrackerStore
            .getState()
            .jobs.find((item) => item.id === jobId)

          return job ? <JobOverlay job={job} /> : null
        }}
      >
        <div
          ref={scrollContainerRef}
          className='scrollbar-thin-subtle flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden overscroll-x-contain'
        >
          <div className='flex min-h-0 flex-1 items-stretch gap-2 pb-2'>
            {BOARD_COLUMNS.map((column) => {
              const columnJobs = groupedJobs[column.status]
              const highlighted = isColumnHighlighted(column.status)
              const isRejectedColumn = column.status === 'rejected'
              const collapsed = isRejectedColumn && rejectedCollapsed

              return (
                <motion.div
                  key={column.status}
                  layout={!reduceMotion}
                  layoutDependency={rejectedCollapsed}
                  transition={reduceMotion ? { duration: 0 } : SPRING.layout}
                  ref={(element) => {
                    if (element)
                      columnElementsRef.current.set(column.status, element)
                    else columnElementsRef.current.delete(column.status)
                  }}
                  className={cn(
                    'flex min-h-0 flex-col rounded-lg border border-transparent bg-muted/35 transition-colors',
                    highlighted && 'border-primary/40 bg-primary/5',
                    collapsed ? 'w-[44px] shrink-0' : 'min-w-64 flex-1',
                  )}
                  style={{
                    transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
                  }}
                >
                  <motion.div
                    key={collapsed ? 'collapsed' : 'expanded'}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: reduceMotion ? 0 : DURATION.base,
                      ease: EASE.out,
                    }}
                    className='flex min-h-0 flex-1 flex-col'
                  >
                    {collapsed ? (
                      <Button
                        ref={setColumnToggleRef}
                        type='button'
                        variant='ghost'
                        aria-expanded={false}
                        onClick={handleToggleRejected}
                        title={`${column.label}（${columnJobs.length}）· 点击展开`}
                        className='flex h-auto min-h-0 w-full flex-1 flex-col items-center justify-start gap-2.5 rounded-xl px-0 py-4 text-muted-foreground transition-colors hover:bg-muted/50'
                        style={{
                          transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
                        }}
                      >
                        <ChevronRight className='size-4 shrink-0' />
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            APPLICATION_STATUS_DOT_CLASSES[column.status],
                          )}
                        />
                        <span className='[writing-mode:vertical-rl] text-sm font-semibold tracking-wide'>
                          {column.label}
                        </span>
                        <Badge variant='secondary' className='mt-1'>
                          {columnJobs.length}
                        </Badge>
                      </Button>
                    ) : (
                      <>
                        <div className='px-2 pt-2.5 pb-2'>
                          <div className='flex items-center justify-between gap-1'>
                            {isRejectedColumn ? (
                              <Button
                                ref={setColumnToggleRef}
                                type='button'
                                variant='ghost'
                                aria-expanded={true}
                                onClick={handleToggleRejected}
                                className='flex h-auto min-w-0 cursor-pointer items-center gap-2 rounded-sm px-0 py-0 hover:bg-transparent'
                              >
                                <ChevronDown className='size-3.5 shrink-0 text-muted-foreground' />
                                <span
                                  className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    APPLICATION_STATUS_DOT_CLASSES[
                                      column.status
                                    ],
                                  )}
                                />
                                <h3 className='truncate text-sm font-semibold'>
                                  {column.label}
                                </h3>
                              </Button>
                            ) : (
                              <div className='flex min-w-0 items-center gap-2'>
                                <span
                                  className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    APPLICATION_STATUS_DOT_CLASSES[
                                      column.status
                                    ],
                                  )}
                                />
                                <h3 className='truncate text-sm font-semibold'>
                                  {column.label}
                                </h3>
                              </div>
                            )}
                            <Badge
                              variant={highlighted ? 'default' : 'secondary'}
                            >
                              {columnJobs.length}
                            </Badge>
                          </div>
                        </div>

                        <BoardColumnDropArea
                          status={column.status}
                          jobs={columnJobs}
                          highlighted={highlighted}
                          reduceMotion={reduceMotion}
                        />
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </CrossListDragProvider>

      <AlertDialog
        open={pendingMove !== null}
        onOpenChange={(open) => !open && setPendingMove(null)}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()

            const card = scrollContainerRef.current?.querySelector<HTMLElement>(
              `[data-motion-drag-item="${CSS.escape(pendingMoveJobIdRef.current ?? '')}"]`,
            )

            const fallback = document.getElementById(TRACKER_SEARCH_INPUT_ID)
            const target = card ?? fallback

            target?.focus({ preventScroll: true })
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMove?.newStatus === 'offer'
                ? '确认移动到「已录用」？'
                : '确认移动到「已结束」？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove?.newStatus === 'offer'
                ? '将把该职位标记为已录用。'
                : '将把该职位标记为结束流程，可在「已结束」列或筛选下查看。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              ref={focusCancel}
              onClick={() => setPendingMove(null)}
            >
              取消
            </AlertDialogCancel>
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

export default memo(BoardView)
