import { MoreJobs } from '../../more-jobs'
import { useJobWindow } from '../../../hooks/use-job-window'
import type { RefCallback } from 'react'
import type { ApplicationStatus, JobApplication } from '../../../types'
import { motion } from 'motion/react'
import { useCallback, useMemo, useRef } from 'react'
import {
  useCrossListContainer,
  useCrossListItem,
} from '@/components/ui/cross-list-drag'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import { ColumnCard } from '../column-card'

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
  const { dragging, previewing, settling, getDragProps } = useCrossListItem({
    id: job.id,
    containerId,
    index,
  })

  return (
    <motion.div
      {...getDragProps()}
      layout={reduceMotion || previewing ? false : 'position'}
      layoutDependency={layoutItems}
      initial={reduceMotion || previewing ? false : { opacity: 0, y: 8 }}
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
      className={cn(
        'shrink-0 cursor-grab rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing',
        settling && 'opacity-0!',
      )}
    >
      <ColumnCard job={job} previewing={previewing} />
    </motion.div>
  )
}

export function BoardColumnDropArea({
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
  const { rows, ...page } = useJobWindow(jobs, status)
  const itemIds = useMemo(() => rows.map((job) => job.id), [rows])

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
        'flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-b-lg px-2 pt-1 pb-2 transition-[background-color,box-shadow] [scrollbar-width:thin]',
        active && 'bg-primary/5',
        highlighted && !active && 'bg-primary/5',
      )}
      style={{
        boxShadow: active
          ? 'inset 0 0 0 1px color-mix(in oklab, var(--primary) 30%, transparent)'
          : 'inset 0 0 0 1px transparent',
        transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
        transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
      }}
    >
      {jobs.length > 0 ? (
        rows.map((job, index) => (
          <BoardJobItem
            key={job.id}
            job={job}
            containerId={status}
            index={index}
            reduceMotion={reduceMotion}
            layoutItems={rows}
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
      <MoreJobs {...page} />
    </div>
  )
}
