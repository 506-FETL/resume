import { ChevronDown, FileUser, Plus, Search } from 'lucide-react'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  SHARE_GRID_CLASS,
  SHARE_GROUP_CLASS,
  SHARE_GROUP_HEADER_CLASS,
  SHARE_STATUS_FILTERS,
} from '@/pages/share/const'

export function ShareContentSkeleton() {
  return (
    <div
      role='status'
      aria-label='正在加载分享链接'
      className={SHARE_GRID_CLASS}
    >
      {[2, 1].map((linkCount) => (
        <div key={linkCount} aria-hidden='true' className={SHARE_GROUP_CLASS}>
          <div className={SHARE_GROUP_HEADER_CLASS}>
            <Skeleton className='size-10 shrink-0 rounded-xl' />
            <div className='min-w-0 flex-1'>
              <Skeleton className='h-6 w-32 max-w-full sm:h-7.5' />
              <Skeleton className='mt-1.5 h-4 w-20' />
            </div>
          </div>
          <div className='@container/share-links min-w-0'>
            {Array.from({ length: linkCount }, (_, linkIndex) => (
              <div
                key={linkIndex}
                className='grid min-w-0 gap-4 border-b border-border/60 px-3 py-5 last:border-b-0 sm:px-4 @min-[600px]/share-links:grid-cols-[minmax(0,1fr)_auto] @min-[600px]/share-links:gap-6'
              >
                <div className='min-w-0'>
                  <div className='flex min-h-5 items-center gap-2'>
                    <Skeleton className='size-4 shrink-0 rounded-sm' />
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='ml-auto h-3 w-8' />
                  </div>
                  <div className='mt-3 flex flex-wrap gap-2'>
                    <Skeleton className='h-4 w-28' />
                    <Skeleton className='h-4 w-36' />
                  </div>
                </div>
                <div className='flex min-w-0 flex-col justify-center gap-3 @min-[600px]/share-links:w-56'>
                  <Skeleton className='h-4 w-40 @min-[600px]/share-links:self-end' />
                  <div className='flex gap-1.5'>
                    <Skeleton className='h-9 flex-1 rounded-md' />
                    <Skeleton className='h-9 w-20 rounded-md' />
                    <Skeleton className='size-9 rounded-md' />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ShareOverviewSkeleton() {
  return (
    <div
      aria-label='正在加载分享概览'
      className='flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground sm:text-sm'
    >
      {['个分享', '个有效', '次访问'].map((label, index) => (
        <span key={label} className='flex items-center gap-1'>
          {index > 0 && (
            <span aria-hidden className='mr-1 text-border'>
              ·
            </span>
          )}
          {index === 2 && <span>累计</span>}
          <Skeleton className='h-4 w-5' />
          {label}
        </span>
      ))}
    </div>
  )
}

export function SharePageSkeleton() {
  return (
    <PageLayout className='h-full min-h-0 gap-4 overflow-hidden py-4 sm:gap-6 sm:py-6 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-2'>
      <div className='shrink-0 space-y-2'>
        <PageHeader
          title='分享管理'
          actions={
            <Button disabled className='h-9 shrink-0 px-3 text-xs sm:text-sm'>
              <Plus data-icon='inline-start' />
              新建分享
            </Button>
          }
        />
        <ShareOverviewSkeleton />
      </div>
      <section
        aria-label='分享链接'
        className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-5 [@media(max-height:500px)]:gap-2'
      >
        <div className='shrink-0 space-y-4 [@media(max-height:500px)]:space-y-2'>
          <Tabs value='all'>
            <div className='overflow-x-auto border-b'>
              <TabsList
                variant='line'
                aria-label='按分享状态筛选'
                className='h-10! min-w-full justify-between gap-1 p-0 sm:justify-start sm:gap-6'
              >
                {SHARE_STATUS_FILTERS.map(({ value, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    disabled
                    className='relative h-10 flex-1 gap-1 rounded-none px-0 pt-1 pb-3 text-xs sm:flex-none sm:gap-1.5 sm:text-sm'
                  >
                    {label}
                    <span className='rounded-sm px-0.5 text-xs leading-4 text-muted-foreground sm:bg-muted sm:px-1.5 sm:py-0.5'>
                      —
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            <div className='relative min-w-0 flex-1 sm:max-w-85'>
              <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                disabled
                aria-label='搜索分享链接'
                placeholder='搜索分享名称…'
                className='h-9 rounded-md pr-8 pl-9 shadow-none'
              />
            </div>
            <Button
              disabled
              variant='outline'
              className='h-9 w-28 justify-start gap-1.5 rounded-md px-2 text-xs shadow-none sm:w-40 sm:px-3 sm:text-sm'
            >
              <FileUser />
              <span className='min-w-0 flex-1 text-left'>全部简历</span>
              <ChevronDown className='size-3.5' />
            </Button>
          </div>
        </div>
        <div className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]'>
          <ShareContentSkeleton />
        </div>
      </section>
    </PageLayout>
  )
}
