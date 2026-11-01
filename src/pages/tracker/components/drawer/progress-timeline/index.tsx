import type { CSSProperties } from 'react'
import type { ApplicationStatus } from '../../../types'
import { linkHorizontal } from 'd3-shape'
import { Check, CircleCheck, CircleMinus, Minus } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef } from 'react'
import useMeasure from 'react-use-measure'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  ACTIVE_APPLICATION_STAGES,
  APPLICATION_STATUS_CONFIG,
} from '../../../const'
import useTrackerStore from '../../../store'
import { selectTrackerDrawerJob } from '../../../store/selectors'
import {
  getApplicationStageProgress,
  getEndedApplicationStage,
} from '../../../workflow'
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from './stepper'

interface ProgressTimelineProps {
  viewingStage: ApplicationStatus | null
  onStageClick: (status: ApplicationStatus) => void
}

const terminalWidth = 140

const curve = linkHorizontal<
  { source: [number, number]; target: [number, number] },
  [number, number]
>()

export default function ProgressTimeline({
  viewingStage,
  onStageClick,
}: ProgressTimelineProps) {
  const job = useTrackerStore(selectTrackerDrawerJob)
  const reduce = useReducedMotion()
  const [measureRef, bounds] = useMeasure()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const viewport = scrollRef.current
    const active = activeRef.current

    if (!viewport || !active) return

    const viewportBox = viewport.getBoundingClientRect()
    const activeBox = active.getBoundingClientRect()

    const outside =
      activeBox.left < viewportBox.left || activeBox.right > viewportBox.right

    if (outside)
      viewport.scrollTo({
        left:
          viewport.scrollLeft +
          activeBox.left -
          viewportBox.left -
          viewport.clientWidth / 2 +
          activeBox.width / 2,
        behavior: reduce ? 'instant' : 'smooth',
      })
  }, [job?.id, job?.status, reduce, bounds.width])

  if (!job) return null

  const width = bounds.width || 700
  const mainWidth = width - terminalWidth
  const source: [number, number] = [mainWidth * (5.5 / 6) + 14, 64]
  const endedAt = getEndedApplicationStage(job)

  const progress = getApplicationStageProgress(job)

  return (
    <section
      aria-label='求职流程'
      className='min-w-0'
      style={
        {
          '--stepper-duration': `${reduce ? 0 : DURATION.base}s`,
          '--stepper-ease': `cubic-bezier(${EASE.out.join(',')})`,
        } as CSSProperties
      }
    >
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-xs font-medium text-muted-foreground'>流程进度</h3>
        <span className='text-xs text-muted-foreground'>
          {job.status === 'rejected'
            ? endedAt
              ? `结束于：${APPLICATION_STATUS_CONFIG[endedAt].label}`
              : '流程已结束'
            : null}
        </span>
      </div>
      <div
        ref={scrollRef}
        className='scrollbar-thin-subtle -mx-1 overflow-x-auto px-1 pb-1'
      >
        <div ref={measureRef} className='relative flex h-24 min-w-[700px]'>
          <svg
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 size-full overflow-visible'
            viewBox={`0 0 ${width} 128`}
            preserveAspectRatio='none'
          >
            {(['offer', 'rejected'] as const).map((status, index) => (
              <motion.path
                key={status}
                d={
                  curve({
                    source,
                    target: [mainWidth + 54, index === 0 ? 32 : 96],
                  }) ?? ''
                }
                fill='none'
                stroke='currentColor'
                strokeWidth={job.status === status ? 1.8 : 1.25}
                strokeLinecap='round'
                className={cn(
                  'transition-colors duration-[var(--stepper-duration)] ease-[var(--stepper-ease)]',
                  job.status === status
                    ? status === 'offer'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground/25',
                )}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: reduce ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
              />
            ))}
          </svg>
          <Stepper className='flex-1 pt-[34px]' aria-label='在办阶段'>
            {ACTIVE_APPLICATION_STAGES.map((status, index) => {
              const current = job.status === status
              const stepState = progress[index]
              const completed = stepState === 'completed'
              const skipped = stepState === 'skipped'

              const stateLabel = current
                ? '当前阶段'
                : completed
                  ? '已完成'
                  : skipped
                    ? '未进行'
                    : '尚未开始'

              return (
                <StepperItem key={status} state={stepState}>
                  {index < ACTIVE_APPLICATION_STAGES.length - 1 && (
                    <StepperSeparator
                      className={cn(
                        'top-[14px] left-[calc(50%+0.875rem)] w-[calc(100%-1.75rem)]',
                        completed &&
                          ['completed', 'active'].includes(progress[index + 1])
                          ? 'bg-primary'
                          : 'bg-muted-foreground/20',
                      )}
                    />
                  )}
                  <StepperTrigger
                    ref={current ? activeRef : undefined}
                    aria-label={`${APPLICATION_STATUS_CONFIG[status].label}，${stateLabel}`}
                    title={`${APPLICATION_STATUS_CONFIG[status].label} · ${stateLabel}`}
                    aria-pressed={(viewingStage ?? job.status) === status}
                    onClick={() => onStageClick(status)}
                  >
                    <StepperIndicator
                      className={cn(
                        viewingStage === status &&
                          !current &&
                          'ring-2 ring-primary/15',
                      )}
                    >
                      {completed ? (
                        <Check aria-hidden className='size-3.5' />
                      ) : skipped ? (
                        <Minus aria-hidden className='size-3.5' />
                      ) : (
                        index + 1
                      )}
                    </StepperIndicator>
                    <StepperTitle>
                      {APPLICATION_STATUS_CONFIG[status].label}
                    </StepperTitle>
                  </StepperTrigger>
                </StepperItem>
              )
            })}
          </Stepper>
          <div className='relative w-[140px] shrink-0' aria-label='流程结果'>
            {(['offer', 'rejected'] as const).map((status, index) => {
              const current = job.status === status
              const Icon = status === 'offer' ? CircleCheck : CircleMinus

              return (
                <button
                  key={status}
                  ref={current ? activeRef : undefined}
                  type='button'
                  aria-label={APPLICATION_STATUS_CONFIG[status].label}
                  aria-current={current ? 'step' : undefined}
                  aria-pressed={(viewingStage ?? job.status) === status}
                  onClick={() => onStageClick(status)}
                  className={cn(
                    'absolute left-10 z-10 inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg text-xs font-medium outline-none transition-colors duration-[var(--stepper-duration)] ease-[var(--stepper-ease)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    index === 0 ? 'top-[2px]' : 'top-[50px]',
                    current
                      ? status === 'offer'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                      : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full border bg-background transition-[color,background-color,border-color,box-shadow] duration-[var(--stepper-duration)] ease-[var(--stepper-ease)]',
                      viewingStage === status &&
                        !current &&
                        'ring-2 ring-primary/15',
                      current &&
                        (status === 'offer'
                          ? 'border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-500/10'
                          : 'border-red-600 bg-red-600 text-white ring-4 ring-red-500/10'),
                    )}
                  >
                    <Icon className='size-3.5' />
                  </span>
                  {APPLICATION_STATUS_CONFIG[status].label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
