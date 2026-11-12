import { LoadingRegion, PaperSkeleton } from '@/components/loading-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function CatalogSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion
      label='正在加载模板列表'
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(min(100%,15.5rem),1fr))] gap-5',
        className,
      )}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className='min-w-0 overflow-hidden rounded-lg border'
        >
          <PaperSkeleton compact />
          <div className='space-y-2 border-t p-3'>
            <Skeleton className='h-3 w-2/5' />
            <Skeleton className='h-2.5 w-3/5' />
          </div>
        </div>
      ))}
    </LoadingRegion>
  )
}
