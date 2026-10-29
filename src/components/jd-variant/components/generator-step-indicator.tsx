import type { GeneratorPhase } from '../types'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

const STEPS = ['输入 JD', '解析岗位', '针对性改写', '完成'] as const

const PHASE_INDEX: Record<GeneratorPhase, number> = {
  idle: 0,
  parsing: 1,
  rewriting: 2,
  success: 3,
  error: 3,
  aborted: 3,
}

interface GeneratorStepIndicatorProps {
  phase: GeneratorPhase
}

export function GeneratorStepIndicator({ phase }: GeneratorStepIndicatorProps) {
  const currentIndex = PHASE_INDEX[phase]
  const reduceMotion = useReducedMotion()

  return (
    <div className='grid grid-cols-4 gap-2' aria-label='派生进度'>
      {STEPS.map((label, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div
            key={label}
            className='relative flex min-w-0 flex-col items-center gap-2'
            aria-current={isCurrent ? 'step' : undefined}
          >
            {index < STEPS.length - 1 && (
              <span
                aria-hidden='true'
                className='pointer-events-none absolute top-3.5 left-[calc(50%+0.875rem)] h-px w-[calc(100%-1.25rem)] -translate-y-1/2 overflow-hidden bg-border'
              >
                <motion.span
                  className='absolute inset-0 origin-left bg-primary'
                  initial={false}
                  animate={{ scaleX: isComplete ? 1 : 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : DURATION.base,
                    ease: EASE.out,
                  }}
                />
              </span>
            )}
            <div
              className={cn(
                'relative flex size-7 items-center justify-center rounded-full border text-xs font-medium',
                isComplete &&
                  'border-primary bg-primary text-primary-foreground',
                isCurrent && 'border-primary bg-primary/10 text-primary',
                !isComplete &&
                  !isCurrent &&
                  'border-border bg-muted text-muted-foreground',
              )}
            >
              {index + 1}
            </div>

            <div
              className={cn(
                'hidden truncate text-xs sm:block',
                isCurrent
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {label}
            </div>

            <div className='sr-only'>{label}</div>
          </div>
        )
      })}
    </div>
  )
}
