import type { DropResult } from '@hello-pangea/dnd'
import type { ApplicationStatus, JobApplication } from '../types'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { ColumnCard } from './column-card'

const BOARD_COLUMNS: { status: ApplicationStatus, label: string }[] = [
  { status: 'saved', label: 'Saved' },
  { status: 'applied', label: 'Applied' },
  { status: 'screen', label: 'Screen' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
]

interface BoardViewProps {
  jobs: JobApplication[]
  onJobClick?: (job: JobApplication) => void
  onStatusChange?: (jobId: string, newStatus: ApplicationStatus) => void
  isSelectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function BoardView({ jobs, onJobClick, onStatusChange, isSelectMode, selectedIds, onToggleSelect }: BoardViewProps) {
  const getJobsByStatus = (status: ApplicationStatus) =>
    jobs.filter(job => job.status === status)

  // 处理拖拽结束
  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result

    // 如果没有目标位置，不做任何处理
    if (!destination)
      return

    // 获取目标列的状态
    const newStatus = destination.droppableId as ApplicationStatus

    // 调用回调更新状态
    if (onStatusChange) {
      onStatusChange(draggableId, newStatus)
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {/* 添加 max-w-full 限制最大宽度 */}
      <div className="max-w-full overflow-x-auto">
        <div className="flex gap-4 pb-4 min-h-[400px]">
          {BOARD_COLUMNS.map((column) => {
            const columnJobs = getJobsByStatus(column.status)
            return (
              <div
                key={column.status}
                className="flex flex-col min-w-[280px] w-[280px] shrink-0"
              >
                {/* 列标题 */}
                <div className="flex items-center justify-between px-2 py-2">
                  <h3 className="font-semibold">{column.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {columnJobs.length}
                  </span>
                </div>

                {/* Droppable 区域 */}
                <Droppable droppableId={column.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 flex flex-col gap-2 p-2 rounded-lg overflow-y-auto transition-colors ${
                        snapshot.isDraggingOver ? 'bg-primary/10' : 'bg-muted/30'
                      }`}
                    >
                      {columnJobs.length > 0
                        ? (
                            columnJobs.map((job, index) => (
                              <Draggable key={job.id} draggableId={job.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={snapshot.isDragging ? 'opacity-80' : ''}
                                  >
                                    <ColumnCard
                                      job={job}
                                      onClick={() => onJobClick?.(job)}
                                      isSelectMode={isSelectMode}
                                      isSelected={selectedIds?.has(job.id)}
                                      onToggleSelect={onToggleSelect}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )
                        : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                              No jobs
                            </div>
                          )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </div>
    </DragDropContext>
  )
}
