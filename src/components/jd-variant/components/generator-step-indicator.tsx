import type { GeneratorPhase } from '../types'
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

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="派生进度">
      {STEPS.map((label, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <li
            key={label}
            className="relative flex min-w-0 flex-col items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}
          >
            {index > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-3.5 h-px w-[calc(100%+0.5rem)] -translate-y-1/2',
                  isComplete || isCurrent ? 'bg-primary' : 'bg-border',
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative flex size-7 items-center justify-center rounded-full border text-xs font-medium',
                isComplete && 'border-primary bg-primary text-primary-foreground',
                isCurrent && 'border-primary bg-primary/10 text-primary',
                !isComplete && !isCurrent && 'border-border bg-muted text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                'hidden truncate text-xs sm:block',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            <span className="sr-only">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
