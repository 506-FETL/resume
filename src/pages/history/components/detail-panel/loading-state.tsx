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
      className='flex h-full min-h-0 flex-col gap-3 px-3 pt-4 sm:px-5 sm:pt-5'
    >
      <Skeleton className={cn('h-7 w-60 max-w-full sm:h-8', skeletonClass)} />
      <div className='flex flex-wrap items-center gap-3'>
        <Skeleton className={cn('h-5 w-10', skeletonClass)} />
        <Skeleton className={cn('h-3 w-12', skeletonClass)} />
        <Skeleton className={cn('h-3 w-28', skeletonClass)} />
      </div>
      <div className='flex gap-2'>
        <Skeleton className={cn('h-8 w-16', skeletonClass)} />
        <Skeleton className={cn('h-8 w-20', skeletonClass)} />
        <Skeleton className={cn('size-8', skeletonClass)} />
        <Skeleton className={cn('size-8', skeletonClass)} />
      </div>
      <div className='border-t border-border/60 py-3'>
        <Skeleton className={cn('h-3 w-20', skeletonClass)} />
      </div>
      <div className='-mx-3 min-h-40 flex-1 bg-muted/35 p-3 sm:-mx-5 sm:p-4'>
        <Skeleton className={cn('h-full w-full rounded-sm', skeletonClass)} />
      </div>
    </div>
  )
}
