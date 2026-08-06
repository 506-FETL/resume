import type { DropResult } from '@hello-pangea/dnd'
import type { ApplicationStatus } from '../../types'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, BOARD_COLUMNS } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, filterJobs, getTrackerErrorMessage } from '../../utils'
import { ColumnCard } from './column-card'

const EDGE_THRESHOLD = 120
const SCROLL_SPEED = 80

export default function BoardView() {
  const { jobs, filterStatus, metricFilter, searchKeyword, showArchived, syncJob, restoreJobsSnapshot, rejectedCollapsed, toggleRejectedCollapsed } = useTrackerStore()
  const reduce = useReducedMotion()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const isDraggingRef = useRef(false)
  const [pendingMove, setPendingMove] = useState<{ jobId: string, newStatus: ApplicationStatus } | null>(null)

  // 拖拽时在库内置自动滚动基础上叠加加速
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current)
        return
      const container = scrollContainerRef.current
      if (!container)
        return

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX

      if (mouseX < rect.left + EDGE_THRESHOLD) {
        const intensity = (rect.left + EDGE_THRESHOLD - mouseX) / EDGE_THRESHOLD
        container.scrollLeft -= SCROLL_SPEED * Math.max(intensity, 0.15)
      }
      else if (mouseX > rect.right - EDGE_THRESHOLD) {
        const intensity = (mouseX - (rect.right - EDGE_THRESHOLD)) / EDGE_THRESHOLD
        container.scrollLeft += SCROLL_SPEED * Math.max(intensity, 0.15)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // 搜索结果在每一列内独立过滤（不按 filterStatus 隐藏列，保留所有列以便拖拽改状态）
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

  // filterStatus 变化时滚动到对应列（仅当横向滚动时才生效）
  useEffect(() => {
    if (filterStatus && BOARD_COLUMNS.some(c => c.status === filterStatus)) {
      requestAnimationFrame(() => {
        scrollToColumn(filterStatus)
      })
    }
  }, [filterStatus, scrollToColumn])

  const handleDragStart = () => {
    isDraggingRef.current = true
  }

  // 提交状态变更（乐观更新 + 落库 + 失败回滚）
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
      .then((savedJob) => {
        syncJob(savedJob)
      })
      .catch((error) => {
        restoreJobsSnapshot({
          jobs: previousState.jobs,
          selectedJob: previousState.selectedJob,
        })
        toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
      })
  }

  const handleDragEnd = (result: DropResult) => {
    isDraggingRef.current = false

    const { destination, draggableId } = result
    if (!destination)
      return

    const newStatus = destination.droppableId as ApplicationStatus
    const currentJob = useTrackerStore.getState().jobs.find(job => job.id === draggableId)

    if (!currentJob || currentJob.status === newStatus)
      return

    // 终态需二次确认，避免误拖
    if (newStatus === 'offer' || newStatus === 'rejected') {
      setPendingMove({ jobId: draggableId, newStatus })
      return
    }

    commitMove(draggableId, newStatus)
  }

  const isColumnHighlighted = (status: ApplicationStatus) =>
    filterStatus !== null && filterStatus === status

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={scrollContainerRef}
          className="w-full min-w-0 overflow-x-auto"
        >
          <div className="flex gap-4 pb-2 xl:gap-5">
            {BOARD_COLUMNS.map((column) => {
              const columnJobs = getJobsByStatus(column.status)
              const highlighted = isColumnHighlighted(column.status)
              const config = APPLICATION_STATUS_CONFIG[column.status]
              const isRejectedColumn = column.status === 'rejected'
              const collapsed = isRejectedColumn && rejectedCollapsed
              return (
                <div
                  key={column.status}
                  ref={(el) => {
                    if (el)
                      columnRefs.current.set(column.status, el)
                  }}
                  className={cn(
                    'flex flex-col',
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
                          className="flex h-full min-h-[320px] w-full flex-col items-center gap-2 rounded-lg border bg-muted/40 py-3 text-muted-foreground transition-colors hover:bg-muted/60 lg:min-h-[calc(100vh-19rem)]"
                        >
                          <ChevronRight className="size-4 shrink-0" />
                          <span className={cn('size-2 shrink-0 rounded-full', config.bgColor)} />
                          <span className="[writing-mode:vertical-rl] text-sm font-semibold tracking-wide">{column.label}</span>
                          <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-background px-1.5 py-0.5 text-xs font-medium">
                            {columnJobs.length}
                          </span>
                        </button>
                      )
                    : (
                        <>
                          <div className={cn(
                            'flex items-center justify-between gap-2 rounded-t-lg border border-b-0 bg-muted/40 px-3 py-2',
                            highlighted && 'border-primary/50 bg-primary/10',
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
                            <span className={cn(
                              'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium',
                              highlighted ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground',
                            )}
                            >
                              {columnJobs.length}
                            </span>
                          </div>

                          <Droppable droppableId={column.status}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  'flex min-h-[320px] flex-1 flex-col gap-2 rounded-b-lg border bg-muted/20 p-2.5 transition-colors lg:min-h-[calc(100vh-22rem)]',
                                  snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-primary/30',
                                  highlighted && !snapshot.isDraggingOver && 'border-primary/50 bg-primary/5',
                                )}
                              >
                                {columnJobs.length > 0
                                  ? (
                                      columnJobs.map((job, index) => (
                                        <Draggable key={job.id} draggableId={job.id} index={index}>
                                          {(dragProvided, dragSnapshot) => (
                                            <div
                                              ref={dragProvided.innerRef}
                                              {...dragProvided.draggableProps}
                                              {...dragProvided.dragHandleProps}
                                              className={dragSnapshot.isDragging ? 'opacity-90 shadow-lg' : ''}
                                            >
                                              <motion.div
                                                initial={reduce || dragSnapshot.isDragging ? false : { opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03 }}
                                              >
                                                <ColumnCard job={job} />
                                              </motion.div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))
                                    )
                                  : (
                                      <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                                        拖拽职位至此
                                      </div>
                                    )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </>
                      )}
                </div>
              )
            })}
          </div>
        </div>
      </DragDropContext>

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
