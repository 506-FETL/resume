import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { LoadingRegion } from '@/components/loading-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { ReleaseCover } from '@/pages/changelog/components/release-cover'
import { RELEASE_1_0 } from '@/pages/changelog/const'

export function ChangelogPageSkeleton() {
  return (
    <PageLayout className='max-w-5xl'>
      <PageHeader
        title='更新日志'
        description='查看 GResume 的功能更新与体验改进。'
      />
      <div className='pt-2'>
        <div className='release-story'>
          <ReleaseCover release={RELEASE_1_0} />
          <LoadingRegion label='正在加载更新日志' className='release-body'>
            <div className='release-body-heading'>
              <Skeleton className='h-6 w-44' />
            </div>
            <div className='release-features' aria-hidden='true'>
              {[0, 1].map((index) => (
                <div key={index} className='release-feature'>
                  <Skeleton className='h-[22px] w-24' />
                  <Skeleton className='mt-3 h-9 w-4/5' />
                  <Skeleton className='mt-3 h-3.5 w-full' />
                  <Skeleton className='mt-3 h-3.5 w-full' />
                  <Skeleton className='mt-3 h-3.5 w-3/4' />
                </div>
              ))}
            </div>
          </LoadingRegion>
        </div>
      </div>
    </PageLayout>
  )
}
