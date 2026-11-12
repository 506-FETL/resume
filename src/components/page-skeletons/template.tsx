import { ChevronDown, Columns2, Palette, SlidersHorizontal } from 'lucide-react'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { LoadingRegion } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CatalogSkeleton from '@/pages/template/components/catalog-skeleton'

export function TemplateFilterOptionsSkeleton() {
  return (
    <LoadingRegion label='正在加载筛选选项' className='space-y-2 px-3 py-2'>
      <Skeleton className='h-3 w-20' />
      <Skeleton className='h-3 w-16' />
    </LoadingRegion>
  )
}

export function TemplatePageSkeleton() {
  return (
    <PageLayout width='wide'>
      <PageHeader title='简历模板' description='挑选适合的排版' />
      <div className='grid min-w-0 items-start gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]'>
        <aside aria-label='筛选模板' className='self-start lg:sticky lg:top-6'>
          <div className='flex items-center justify-between gap-1 pb-2.5'>
            <h2 className='min-w-0 flex-1'>
              <Button
                disabled
                variant='ghost'
                className='min-h-9 w-full gap-1.5 px-1 text-sm font-medium'
              >
                <SlidersHorizontal className='size-3.5' />
                筛选模板
                <ChevronDown className='ml-auto size-3.5' />
              </Button>
            </h2>
            <Button disabled variant='ghost' size='xs' className='px-1 text-xs'>
              重置
            </Button>
          </div>
          <TemplateFilterOptionsSkeleton />
          <div className='grid gap-3 border-t border-border/60 py-3 lg:gap-5 lg:py-4'>
            {[
              { title: '模板风格', all: '全部风格', icon: Palette },
              { title: '排版布局', all: '全部布局', icon: Columns2 },
            ].map(({ title, all, icon: Icon }) => (
              <div key={title}>
                <div className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 lg:hidden'>
                  <span className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                    <Icon className='size-3.5' />
                    {title}
                  </span>
                  <Button
                    disabled
                    variant='outline'
                    className='w-full justify-between font-normal'
                  >
                    {all}
                    <ChevronDown className='size-4 opacity-50' />
                  </Button>
                </div>
                <div className='hidden lg:block'>
                  <Button
                    disabled
                    variant='ghost'
                    className='min-h-9 w-full gap-2 px-2 text-xs font-medium text-muted-foreground'
                  >
                    <Icon className='size-3.5' />
                    {title}
                    <ChevronDown className='ml-auto size-3.5' />
                  </Button>
                  <div className='px-1 pt-1 pb-1'>
                    <Button
                      disabled
                      variant='secondary'
                      className='min-h-9 w-full justify-start px-3'
                    >
                      {all}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
        <section aria-label='模板列表' className='min-w-0 space-y-4'>
          <h2 className='flex min-h-9 items-center text-sm font-medium'>
            全部模板
          </h2>
          <CatalogSkeleton />
        </section>
      </div>
    </PageLayout>
  )
}
