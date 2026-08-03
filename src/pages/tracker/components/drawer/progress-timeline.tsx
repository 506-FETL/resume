import type { ApplicationStatus } from '../../types'
import { Check, X as XIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER } from '../../const'
import useTrackerStore from '../../store'

interface ProgressTimelineProps {
  viewingStage: ApplicationStatus | null
  onStageClick: (status: ApplicationStatus) => void
  onStageJump: (status: ApplicationStatus) => void
}

export default function ProgressTimeline({ viewingStage, onStageClick, onStageJump }: ProgressTimelineProps) {
  const { selectedJob } = useTrackerStore()
  const reduce = useReducedMotion()

  if (!selectedJob)
    return null

  const { status: currentStatus } = selectedJob
  const currentIndex = APPLICATION_STATUS_ORDER.indexOf(currentStatus)
  const isRejected = currentStatus === 'rejected'
  const focusedStage = viewingStage ?? currentStatus

  // 非终态时所有正向阶段均可点：点当前=查看，点其他=跳转到该阶段
  const handleActivate = (status: ApplicationStatus, clickable: boolean) => {
    if (!clickable)
      return
    if (status === currentStatus)
      onStageClick(status)
    else onStageJump(status)
  }

  return (
    <div className="px-1">
      <ol className="flex items-start">
        {APPLICATION_STATUS_ORDER.map((status, index) => {
          const config = APPLICATION_STATUS_CONFIG[status]
          const isCompleted = !isRejected && index < currentIndex
          const isCurrent = !isRejected && index === currentIndex
          const isFocused = focusedStage === status
          const isClickable = !isRejected

          const dotClass = cn(
            'relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-all',
            isRejected
              ? 'border-destructive/60 bg-destructive/10 text-destructive'
              : isCompleted
                ? 'border-primary bg-primary text-primary-foreground'
                : isCurrent
                  ? 'border-primary bg-background text-primary ring-4 ring-primary/15'
                  : 'border-border bg-background text-muted-foreground',
            isFocused && !isCurrent && 'ring-2 ring-primary/30',
            isClickable && 'cursor-pointer',
            !isClickable && 'cursor-not-allowed opacity-70',
          )

          const labelClass = cn(
            'mt-2 block text-center text-[11px] font-medium leading-tight transition-colors',
            isRejected
              ? 'text-destructive'
              : isCompleted || isCurrent
                ? 'text-foreground'
                : 'text-muted-foreground',
            isFocused && 'font-semibold',
          )

          return (
            <li key={status} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    'h-0.5 flex-1 transition-colors',
                    index === 0
                      ? 'invisible'
                      : isRejected
                        ? 'bg-destructive/40'
                        : index <= currentIndex
                          ? 'bg-primary'
                          : 'bg-border',
                  )}
                />
                <motion.button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => handleActivate(status, isClickable)}
                  aria-label={config.label}
                  className={dotClass}
                  whileHover={reduce || !isClickable ? undefined : { scale: 1.1 }}
                  animate={reduce ? undefined : { scale: isCompleted || isCurrent ? [1, 1.15, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isRejected ? <XIcon className="size-3.5" /> : isCompleted ? <Check className="size-3.5" /> : index + 1}
                </motion.button>
                <span
                  className={cn(
                    'h-0.5 flex-1 transition-colors',
                    index === APPLICATION_STATUS_ORDER.length - 1
                      ? 'invisible'
                      : isRejected
                        ? 'bg-destructive/40'
                        : index < currentIndex
                          ? 'bg-primary'
                          : index === currentIndex
                            ? 'bg-gradient-to-r from-primary to-border'
                            : 'bg-border',
                  )}
                />
              </div>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => handleActivate(status, isClickable)}
                className={cn('w-full', isClickable ? 'cursor-pointer' : 'cursor-not-allowed')}
              >
                <span className={labelClass}>{config.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
