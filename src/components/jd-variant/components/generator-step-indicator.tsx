import type { GeneratorPhase } from '../types'
import { Check } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'

const STEPS = ['职位描述', '岗位解析', '简历改写', '查看结果'] as const

interface GeneratorStepIndicatorProps {
  phase: GeneratorPhase
  step: number
}

export function GeneratorStepIndicator({
  phase,
  step,
}: GeneratorStepIndicatorProps) {
  const reduceMotion = useReducedMotion()
  const interrupted = phase === 'error' || phase === 'aborted'

  return (
    <ol className='grid grid-cols-4 gap-2' aria-label='岗位定制进度'>
      {STEPS.map((label, index) => {
        const isComplete = index < step - 1
        const isCurrent = index === step - 1

        return (
          <li
            key={label}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-1.5 text-xs sm:flex-row',
              isCurrent
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden
              style={{ transitionDuration: reduceMotion ? '0s' : undefined }}
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease)',
                isComplete && 'bg-primary/10 text-primary',
                isCurrent &&
                  !interrupted &&
                  'bg-primary text-primary-foreground',
                isCurrent && interrupted && 'bg-muted text-muted-foreground',
                !isComplete && !isCurrent && 'bg-muted text-muted-foreground',
              )}
            >
              {isComplete ? <Check className='size-3' /> : index + 1}
            </span>
            <span className='whitespace-nowrap'>{label}</span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                style={{ transitionDuration: reduceMotion ? '0s' : undefined }}
                className={cn(
                  'absolute top-2.5 left-[calc(50%+0.875rem)] h-px w-[calc(100%-1.25rem)] transition-colors duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) sm:static sm:w-auto sm:flex-1',
                  isComplete ? 'bg-primary/50' : 'bg-border',
                )}
              />
            )}
            {isComplete && <span className='sr-only'>已完成</span>}
            {isCurrent && interrupted && (
              <span className='sr-only'>已停止</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
