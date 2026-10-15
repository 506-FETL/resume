import type { CSSProperties } from 'react'
import type { ApplicationStatus } from '../../../types'
import { linkHorizontal } from 'd3-shape'
import { Check, CircleCheck, CircleMinus, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import useMeasure from 'react-use-measure'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ACTIVE_APPLICATION_STAGES, APPLICATION_STATUS_CONFIG } from '../../../const'
import useTrackerStore from '../../../store'
import { selectTrackerDrawerJob } from '../../../store/selectors'
import { getEndedApplicationStage } from '../../../workflow'
import { Stepper, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger } from './stepper'

interface ProgressTimelineProps {
  viewingStage: ApplicationStatus | null
  onStageClick: (status: ApplicationStatus) => void
  onStageJump: (status: ApplicationStatus) => void
}

const terminalWidth = 140
const curve = linkHorizontal<{ source: [number, number], target: [number, number] }, [number, number]>()

export default function ProgressTimeline({ viewingStage, onStageClick, onStageJump }: ProgressTimelineProps) {
  const job = useTrackerStore(selectTrackerDrawerJob)
  const reduce = useReducedMotion()
  const [measureRef, bounds] = useMeasure()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const viewport = scrollRef.current
    const active = activeRef.current
    if (!viewport || !active)
      return
    const viewportBox = viewport.getBoundingClientRect()
    const activeBox = active.getBoundingClientRect()
    const outside = activeBox.left < viewportBox.left || activeBox.right > viewportBox.right
    if (outside)
      viewport.scrollTo({ left: viewport.scrollLeft + activeBox.left - viewportBox.left - viewport.clientWidth / 2 + activeBox.width / 2, behavior: reduce ? 'instant' : 'smooth' })
  }, [job?.id, job?.status, reduce, bounds.width])

  if (!job)
    return null

  const width = bounds.width || 700
  const mainWidth = width - terminalWidth
  const source: [number, number] = [mainWidth * (5.5 / 6) + 14, 64]
  const endedAt = getEndedApplicationStage(job)
  const currentIndex = ACTIVE_APPLICATION_STAGES.findIndex(stage => stage === job.status)
  const terminalSource = job.status === 'rejected' ? endedAt : job.stage_details.find(detail => detail.stage === 'offer')?.source_stage
  const progressIndex = currentIndex >= 0
    ? currentIndex
    : terminalSource
      ? ACTIVE_APPLICATION_STAGES.indexOf(terminalSource)
      : ACTIVE_APPLICATION_STAGES.reduce((furthest, stage, index) => job.stage_details.some(detail => detail.stage === stage && detail.status === '已完成') ? index : furthest, -1)
  const activate = (status: ApplicationStatus) => status === job.status ? onStageClick(status) : onStageJump(status)

  return (
    <section aria-label="求职流程" className="min-w-0" style={{ '--stepper-duration': `${reduce ? 0 : DURATION.base}s`, '--stepper-ease': `cubic-bezier(${EASE.out.join(',')})` } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">流程进度</h3>
        <span className="text-xs text-muted-foreground">
          {job.status === 'rejected' ? (endedAt ? `结束于：${APPLICATION_STATUS_CONFIG[endedAt].label}` : '流程已结束') : APPLICATION_STATUS_CONFIG[job.status].label}
        </span>
      </div>
      <div ref={scrollRef} className="scrollbar-thin-subtle -mx-1 overflow-x-auto px-1 pb-1">
        <div ref={measureRef} className="relative flex h-24 min-w-[700px] md:h-32">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${width} 128`} preserveAspectRatio="none">
            {(['offer', 'rejected'] as const).map((status, index) => (
              <motion.path
                key={status}
                d={curve({ source, target: [mainWidth + 54, index === 0 ? 32 : 96] }) ?? ''}
                fill="none"
                stroke="currentColor"
                strokeWidth={job.status === status ? 1.8 : 1.25}
                strokeLinecap="round"
                className={cn('transition-colors duration-[var(--stepper-duration)] ease-[var(--stepper-ease)]', job.status === status ? (status === 'offer' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-muted-foreground/25')}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : DURATION.base, ease: EASE.out }}
              />
            ))}
          </svg>
          <Stepper className="flex-1 pt-[34px] md:pt-[50px]" aria-label="在办阶段">
            {ACTIVE_APPLICATION_STAGES.map((status, index) => {
              const detail = job.stage_details.find(item => item.stage === status)
              const current = job.status === status
              const ended = job.status === 'rejected' && status === endedAt
              const completed = detail?.status === '已完成' || ended
              const unrecorded = index < progressIndex && !completed
              const stepState = current ? 'active' : completed ? 'completed' : 'inactive'
              return (
                <StepperItem key={status} state={stepState}>
                  {index < ACTIVE_APPLICATION_STAGES.length - 1 && <StepperSeparator className={cn('top-[14px] left-[calc(50%+0.875rem)] w-[calc(100%-1.75rem)]', index < progressIndex ? 'bg-primary' : 'bg-muted-foreground/20')} />}
                  <StepperTrigger ref={current ? activeRef : undefined} aria-label={APPLICATION_STATUS_CONFIG[status].label} title={unrecorded ? `${APPLICATION_STATUS_CONFIG[status].label} · 未记录` : undefined} onClick={() => activate(status)}>
                    <StepperIndicator className={cn(viewingStage === status && !current && 'ring-2 ring-primary/15', unrecorded && 'border-primary/20 bg-muted text-muted-foreground')}>
                      {completed ? <Check className="size-3.5" /> : unrecorded ? <Minus className="size-3.5" /> : index + 1}
                    </StepperIndicator>
                    <StepperTitle>{APPLICATION_STATUS_CONFIG[status].label}</StepperTitle>
                    {unrecorded && <span className="sr-only text-[10px] text-muted-foreground/75 md:not-sr-only md:absolute md:top-[53px]">未记录</span>}
                  </StepperTrigger>
                </StepperItem>
              )
            })}
          </Stepper>
          <div className="relative w-[140px] shrink-0" aria-label="流程结果">
            {(['offer', 'rejected'] as const).map((status, index) => {
              const current = job.status === status
              const Icon = status === 'offer' ? CircleCheck : CircleMinus
              return (
                <button
                  key={status}
                  ref={current ? activeRef : undefined}
                  type="button"
                  aria-label={APPLICATION_STATUS_CONFIG[status].label}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => activate(status)}
                  className={cn('absolute left-10 z-10 inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg text-xs font-medium outline-none transition-colors duration-[var(--stepper-duration)] ease-[var(--stepper-ease)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', index === 0 ? 'top-[2px] md:top-[10px]' : 'top-[50px] md:top-[74px]', current ? status === 'offer' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400' : 'text-muted-foreground')}
                >
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border bg-background transition-[color,background-color,border-color,box-shadow] duration-[var(--stepper-duration)] ease-[var(--stepper-ease)]', current && (status === 'offer' ? 'border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-500/10' : 'border-red-600 bg-red-600 text-white ring-4 ring-red-500/10'))}>
                    <Icon className="size-3.5" />
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
