import type { RefCallback } from 'react'
import type { ApplicationStatus, JobApplication } from '../../types'
import type { CrossListDropResult } from '@/components/ui/cross-list-drag'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CrossListDragProvider } from '@/components/ui/cross-list-drag'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_DOT_CLASSES, BOARD_COLUMNS } from '../../const'
import { isTrackerAccountScopeError } from '../../lib/account-scope'
import useTrackerStore, { getTrackerConflictAction } from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import {
  filterJobs,
  getTrackerErrorMessage,
  resolveTrackerMetricStatus,
} from '../../utils'
import { BoardColumnDropArea } from './column-drop-area'
import { JobOverlay } from './job-overlay'
import { MoveConfirmation } from './move-confirmation'

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
        filterStatus,
        searchKeyword,
        showArchived,
        metricFilter,
        focusedOnly,
      ),
    [
      jobs,
      filterStatus,
      metricFilter,
      searchKeyword,
      showArchived,
      filterCompanyId,
      focusedOnly,
    ],
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
    const save = changeJobStatus(jobId, newStatus).catch((error) => {
      if (!isTrackerAccountScopeError(error))
        toast.error('更新状态失败', {
          description: getTrackerErrorMessage(error),
          action: getTrackerConflictAction(error),
        })
    })

    const { submissionQueue, reopenQueue } = useTrackerStore.getState()

    // 需要用户补充投递或恢复流程时，预览先回源，不停留在弹窗上方。
    if (
      submissionQueue.some((request) => request.jobId === jobId) ||
      reopenQueue.some((request) => request.jobId === jobId)
    )
      return

    return save
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

    return commitMove(itemId, newStatus)
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
        renderOverlay={(jobId, settling) => {
          const job = useTrackerStore
            .getState()
            .jobs.find((item) => item.id === jobId)

          return job ? <JobOverlay job={job} settling={settling} /> : null
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
                    'flex min-h-0 flex-col rounded-lg border border-transparent bg-muted/25 transition-colors',
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

      <MoveConfirmation
        pendingMove={pendingMove}
        setPendingMove={setPendingMove}
        scrollContainerRef={scrollContainerRef}
        pendingMoveJobIdRef={pendingMoveJobIdRef}
        focusCancel={focusCancel}
        commitMove={commitMove}
      />
    </>
  )
}

export default memo(BoardView)
