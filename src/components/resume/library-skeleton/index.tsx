import { PageLayout } from '@/components/layout/page-layout'
import { Skeleton } from '@/components/ui/skeleton'

export function ResumeLibrarySkeleton() {
  return (
    <PageLayout
      role='status'
      aria-label='正在加载简历'
      className='h-full min-h-0 gap-4 overflow-hidden py-4 sm:gap-6 sm:py-6 [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-1'
    >
      <div className='shrink-0 space-y-4 sm:space-y-6 [@media(max-height:500px)]:space-y-1'>
        <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-4'>
          <div className='flex min-w-0 items-center gap-2'>
            <h1 className='text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]'>
              我的简历
            </h1>
            <Skeleton className='h-5 w-10' />
          </div>
          <Skeleton className='col-span-2 row-start-2 h-5 w-64 max-w-full lg:col-span-1 lg:col-start-2 lg:row-start-1' />
          <Skeleton className='col-start-2 row-start-1 h-9 w-24 lg:col-start-3' />
        </div>
        <div className='flex flex-col gap-2 sm:flex-row sm:justify-between [@media(max-height:500px)]:gap-1'>
          <Skeleton className='h-9 w-full sm:max-w-80' />
          <Skeleton className='h-9 w-60 max-w-full' />
        </div>
      </div>

      <div className='min-h-0 min-w-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]'>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className='grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 px-2 py-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-8 sm:px-4 sm:py-6'
          >
            <Skeleton className='aspect-[210/297] w-full self-start rounded-sm sm:row-span-2 sm:self-center' />
            <div className='min-w-0 space-y-3'>
              <Skeleton className='h-8 w-72 max-w-full' />
              <div className='flex flex-wrap gap-2'>
                <Skeleton className='h-5 w-20' />
                <Skeleton className='h-5 w-24' />
              </div>
              <Skeleton className='h-4 w-80 max-w-full' />
            </div>
            <div className='col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2'>
              <Skeleton className='h-9 w-24' />
              <Skeleton className='h-9 w-40' />
            </div>
          </div>
        ))}
      </div>

      <footer
        aria-hidden
        className='shrink-0 border-t bg-background pt-3 pb-[env(safe-area-inset-bottom)] [@media(max-height:500px)]:pt-1'
      >
        <div className='flex min-h-8 items-center justify-end gap-2'>
          <Skeleton className='mr-1 h-4 w-40' />
          <Skeleton className='size-8' />
          <Skeleton className='size-8' />
        </div>
      </footer>
    </PageLayout>
  )
}
