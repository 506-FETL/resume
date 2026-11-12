import { ChevronDown, History, Save } from 'lucide-react'
import { PageLayout } from '@/components/layout/page-layout'
import { LoadingRegion, PaperSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function HistoryVersionRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className='flex flex-col gap-1'>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className='flex flex-col gap-2 p-2.5'>
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-3 w-2/3' />
          <Skeleton className='h-3 w-2/5' />
        </div>
      ))}
    </div>
  )
}

export function HistoryTimelineSkeleton() {
  return (
    <LoadingRegion
      label='正在加载版本记录'
      className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border/70 @min-[900px]/workspace:border-r'
    >
      <div className='flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2'>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          <History aria-hidden className='size-4 text-muted-foreground' />
          版本记录
        </h2>
        <Skeleton className='h-3 w-14' />
      </div>
      <div className='shrink-0 px-2 pb-1'>
        <HistoryVersionRowsSkeleton count={1} />
      </div>
      <div className='scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-3'>
        <HistoryVersionRowsSkeleton />
      </div>
    </LoadingRegion>
  )
}

export function HistoryDetailSkeleton() {
  return (
    <LoadingRegion
      label='正在加载版本详情'
      className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
    >
      <div className='shrink-0 space-y-3 px-3 pt-4 pb-3 sm:px-5 sm:pt-5 [@media(max-height:500px)]:py-0'>
        <Skeleton className='h-7 w-60 max-w-full sm:h-8' />
        <div className='flex flex-wrap items-center gap-3'>
          <Skeleton className='h-5 w-10' />
          <Skeleton className='h-3 w-12' />
          <Skeleton className='h-3 w-28' />
        </div>
        <div className='flex gap-2'>
          <Skeleton className='h-9 w-16' />
          <Skeleton className='h-9 w-20' />
          <Skeleton className='size-9' />
          <Skeleton className='size-9' />
        </div>
      </div>
      <div className='mx-3 flex h-11 shrink-0 items-center border-t border-border/60 px-2 sm:mx-5 [@media(max-height:500px)]:h-9'>
        <Skeleton className='h-3 w-20' />
      </div>
      <div className='min-h-0 flex-1 overflow-hidden bg-muted/35 p-2 sm:p-4'>
        <PaperSkeleton className='mx-auto max-w-[794px] shadow-sm' />
      </div>
    </LoadingRegion>
  )
}

export function HistoryWorkspaceSkeleton() {
  return (
    <div className='grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 @min-[900px]/workspace:grid-cols-[clamp(16rem,23%,20rem)_minmax(0,1fr)]'>
      <HistoryTimelineSkeleton />
      <div className='hidden min-h-0 min-w-0 flex-col @min-[900px]/workspace:flex'>
        <HistoryDetailSkeleton />
      </div>
    </div>
  )
}

export function HistoryPageSkeleton() {
  return (
    <PageLayout
      workspace
      className='min-h-0 overflow-hidden [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-1'
    >
      <header className='grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 @min-[760px]/workspace:grid-cols-[auto_minmax(0,1fr)_auto] [@media(max-height:500px)]:grid-cols-[minmax(0,1fr)_auto] [@media(max-height:500px)]:gap-2'>
        <div className='min-w-0 [@media(max-height:500px)]:sr-only'>
          <h1 className='whitespace-nowrap text-xl leading-8 font-semibold tracking-tight sm:text-2xl'>
            历史版本
          </h1>
        </div>
        <div className='col-start-2 row-start-1 @min-[760px]/workspace:col-start-3 [@media(max-height:500px)]:col-start-2'>
          <Button disabled>
            <Save data-icon='inline-start' />
            保存当前版本
          </Button>
        </div>
        <div className='col-span-2 min-w-0 @min-[760px]/workspace:col-span-1 @min-[760px]/workspace:col-start-2 @min-[760px]/workspace:row-start-1 @min-[760px]/workspace:max-w-md [@media(max-height:500px)]:col-span-1 [@media(max-height:500px)]:col-start-1 [@media(max-height:500px)]:row-start-1'>
          <Button
            variant='outline'
            disabled
            className='w-full justify-between font-normal shadow-none'
          >
            <span>选择一份云端简历</span>
            <ChevronDown className='opacity-50' />
          </Button>
        </div>
      </header>
      <HistoryWorkspaceSkeleton />
    </PageLayout>
  )
}
