import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function DetailPanelLoadingState() {
  const reduceMotion = useReducedMotion()
  const skeletonClass = reduceMotion ? 'animate-none' : undefined

  return (
    <div
      role='status'
      aria-label='正在加载版本详情'
      className='flex h-full min-h-0 flex-col gap-4 p-5'
    >
      <Skeleton className={cn('h-5 w-20', skeletonClass)} />
      <Skeleton className={cn('h-6 w-48 max-w-full', skeletonClass)} />
      <Skeleton className={cn('h-3 w-36', skeletonClass)} />
      <div className='mt-2 flex gap-2'>
        <Skeleton className={cn('h-8 w-20', skeletonClass)} />
        <Skeleton className={cn('h-8 w-20', skeletonClass)} />
      </div>
      <Skeleton
        className={cn('min-h-40 w-full flex-1 rounded-lg', skeletonClass)}
      />
    </div>
  )
}
