import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PreferencesCard } from '@/pages/profile/components/preferences-card'

export function ProfilePageSkeleton() {
  return (
    <PageLayout width='narrow' aria-label='正在加载个人信息' aria-busy='true'>
      <PageHeader
        title='个人信息'
        description='管理个人资料、账户安全与使用偏好。'
      />
      <div className='flex flex-col gap-5 border-b pb-6'>
        <h2 className='text-base font-semibold'>个人资料</h2>
        <div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6'>
          <Skeleton className='size-24 shrink-0 rounded-full' />
          <Skeleton className='h-5 w-24' />
        </div>
        <div className='divide-y'>
          {['用户名', '邮箱地址', '注册时间', '最后更新'].map((label, item) => (
            <div
              key={label}
              className='grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center'
            >
              <span className='text-sm font-medium'>{label}</span>
              <div className='flex min-w-0 items-center justify-between gap-2'>
                <Skeleton className='h-6 w-full max-w-56' />
                {item < 2 && <Skeleton className='size-9 shrink-0' />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className='space-y-5 border-b pb-6'>
        <h2 className='text-base font-semibold'>账户设置</h2>
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-4'>
            <span className='text-sm font-medium'>修改密码</span>
            <Skeleton className='h-9 w-24' />
          </div>
          <Separator />
          <div className='flex items-center justify-between gap-4'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-5 w-20' />
          </div>
          <div className='space-y-3'>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className='space-y-1 not-first:border-t not-first:pt-3'
              >
                <Skeleton className='h-5 w-28' />
                <Skeleton className='h-4 w-40' />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className='space-y-5 border-b pb-6'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <h2 className='text-base font-semibold'>AI 每日额度</h2>
            <Skeleton className='h-5 w-56 max-w-full' />
          </div>
          <Skeleton className='h-8 w-24' />
        </div>
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-5 w-16' />
            <Skeleton className='h-5 w-32' />
          </div>
          <Skeleton className='h-2 w-full rounded-full' />
          <Skeleton className='h-5 w-40' />
        </div>
      </div>
      <PreferencesCard />
    </PageLayout>
  )
}
