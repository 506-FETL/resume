import {
  BrainCircuit,
  ChevronDown,
  ClipboardCheck,
  FileText,
  RefreshCcw,
} from 'lucide-react'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { ContentSkeleton, LoadingRegion } from '@/components/loading-skeleton'
import { Badge } from '@/components/ui/badge'
import { TOOL_DEFINITIONS } from '@/pages/optimize/components/advanced-tools/shared/config'
import { ToolCard } from '@/pages/optimize/components/advanced-tools/shared/tool-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'

export function OptimizeSummarySkeleton() {
  return (
    <LoadingRegion label='正在读取检测报告' className='min-w-0 py-6 sm:py-8'>
      <div className='grid min-w-0 items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)] md:gap-10'>
        <div className='space-y-3'>
          <Skeleton className='h-12 w-24' />
          <Skeleton className='h-5 w-28' />
        </div>
        <div className='space-y-5'>
          <div className='space-y-2'>
            <Skeleton className='h-7 w-3/4' />
            <Skeleton className='h-7 w-full max-w-xl' />
          </div>
          <Skeleton className='h-8 w-36' />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function OptimizeFindingsSkeleton() {
  return <ContentSkeleton label='正在读取检测报告' className='px-0' rows={3} />
}

export function OptimizeChecklistSkeleton() {
  return <ContentSkeleton label='正在读取修复清单' className='p-0' rows={2} />
}

export function OptimizeBasisSkeleton() {
  const isMobile = useIsMobile()

  return (
    <section className='min-w-0 border-t pt-6'>
      {isMobile ? (
        <Button
          disabled
          variant='ghost'
          className='h-auto w-full justify-between gap-3 px-0 py-2 hover:bg-transparent'
        >
          <span className='flex items-center gap-2 text-lg font-semibold'>
            <BrainCircuit
              aria-hidden
              className='size-4 text-muted-foreground'
            />
            评分依据
          </span>
          <ChevronDown aria-hidden className='size-4 shrink-0' />
        </Button>
      ) : (
        <h2 className='flex items-center gap-2 text-lg font-semibold tracking-tight'>
          <BrainCircuit aria-hidden className='size-4 text-muted-foreground' />
          评分依据
        </h2>
      )}
      {!isMobile && (
        <LoadingRegion label='正在读取评分依据' className='space-y-6 pt-5'>
          <div className='space-y-3'>
            <Skeleton className='h-5 w-36' />
            <Skeleton className='h-4 w-3/4 max-w-2xl' />
          </div>
          <div className='grid min-w-0 items-start gap-8 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10'>
            <div className='space-y-4'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='mx-auto size-48 max-w-full rounded-full' />
              <div className='grid grid-cols-2 gap-3'>
                {[0, 1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className='h-3 w-full' />
                ))}
              </div>
            </div>
            <div className='space-y-6'>
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className='space-y-3 border-b border-border/60 pb-5'
                >
                  <Skeleton className='h-5 w-32' />
                  <Skeleton className='h-3 w-full' />
                  <Skeleton className='h-3 w-4/5' />
                </div>
              ))}
            </div>
          </div>
        </LoadingRegion>
      )}
    </section>
  )
}

export function OptimizePageSkeleton() {
  return (
    <PageLayout>
      <div className='min-w-0 space-y-4'>
        <PageHeader
          title='简历优化'
          description='按优先级完善内容'
          actions={
            <>
              <Button variant='outline' size='sm' disabled>
                <FileText />
                <span className='text-xs'>选择简历</span>
                <ChevronDown className='opacity-50' />
              </Button>
              <Button size='sm' disabled>
                <RefreshCcw />
                开始检测
              </Button>
            </>
          }
        />
      </div>
      <OptimizeSummarySkeleton />
      <div className='grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-10'>
        <section className='min-w-0 xl:col-start-1 xl:row-start-1'>
          <header className='flex flex-wrap items-center justify-between gap-3 pb-4'>
            <h2 className='text-lg font-semibold tracking-tight'>问题分析</h2>
          </header>
          <OptimizeFindingsSkeleton />
        </section>
        <aside className='min-w-0 border-t pt-6 xl:col-start-2 xl:row-start-1 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6'>
          <header className='pb-4'>
            <h2 className='flex items-center gap-2 text-base font-semibold'>
              <ClipboardCheck
                aria-hidden
                className='size-4 text-muted-foreground'
              />
              修复清单
            </h2>
          </header>
          <OptimizeChecklistSkeleton />
        </aside>
      </div>
      <OptimizeBasisSkeleton />
      <section className='min-w-0 border-t pt-6'>
        <header className='pb-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <h2 className='text-lg font-semibold tracking-tight'>简历工具</h2>
            <Badge className='w-fit rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'>
              请先选择简历
            </Badge>
          </div>
        </header>
        <div className='grid min-w-0 grid-cols-1 gap-x-8 sm:grid-cols-2'>
          {TOOL_DEFINITIONS.map((tool) => (
            <ToolCard key={tool.key} tool={tool} disabled />
          ))}
        </div>
      </section>
    </PageLayout>
  )
}
