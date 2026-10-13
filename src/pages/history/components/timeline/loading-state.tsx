import { useReducedMotion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function TimelineLoadingState({ count = 3 }: { count?: number }) {
  const reduceMotion = useReducedMotion()

  return (
    <div role="status" aria-label="正在加载版本记录" className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
          <Skeleton className={cn('h-3 w-20', reduceMotion && 'animate-none')} />
          <Skeleton className={cn('h-4 w-3/4', reduceMotion && 'animate-none')} />
          <Skeleton className={cn('h-3 w-2/5', reduceMotion && 'animate-none')} />
        </div>
      ))}
    </div>
  )
}
