import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function TimelineLoadingState({
  count = 3,
}: {
  count?: number
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      role='status'
      aria-label='正在加载版本记录'
      className='flex flex-col gap-1'
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className='flex flex-col gap-2 p-2.5'>
          <Skeleton
            className={cn('h-4 w-3/4', reduceMotion && 'animate-none')}
          />
          <Skeleton
            className={cn('h-3 w-2/3', reduceMotion && 'animate-none')}
          />
          <Skeleton
            className={cn('h-3 w-2/5', reduceMotion && 'animate-none')}
          />
        </div>
      ))}
    </div>
  )
}
