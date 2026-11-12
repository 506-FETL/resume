import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import {
  ContentSkeleton,
  FormSkeleton,
  LoadingRegion,
  PaperSkeleton,
} from '@/components/loading-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { ResumeLibrarySkeleton } from '@/components/resume/library-skeleton'
import { WORKSPACE_PATH } from '@/lib/workspace-path'
import { BOARD_COLUMNS } from '@/pages/tracker/const'

const titles: Record<string, string> = {
  [WORKSPACE_PATH]: '首页',
  '/resume': '我的简历',
  '/template': '简历模板',
  '/tracker': '求职跟进',
  '/optimize': '简历优化',
  '/share': '分享管理',
  '/history': '历史版本',
  '/profile': '个人信息',
}

export function RouteSkeleton({
  pathname,
  label = '正在加载页面',
}: {
  pathname: string
  label?: string
}) {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/resume') return <ResumeLibrarySkeleton />

  if (path.startsWith('/share/view/')) {
    return (
      <LoadingRegion
        label='正在加载简历'
        className='min-h-dvh bg-muted/30 px-4 py-6 sm:px-6'
      >
        <PaperSkeleton className='mx-auto max-w-[794px] shadow-sm' />
      </LoadingRegion>
    )
  }

  if (path === '/resume/editor') {
    return (
      <LoadingRegion
        label='正在加载简历'
        className='flex h-full min-h-96 min-w-0 overflow-hidden'
      >
        <div className='min-w-0 flex-1 overflow-hidden bg-muted/30 p-4 sm:p-6'>
          <div className='mx-auto mb-4 flex max-w-[794px] justify-end gap-2'>
            <Skeleton className='h-8 w-20' />
            <Skeleton className='h-8 w-20' />
          </div>
          <PaperSkeleton className='mx-auto max-w-[794px] shadow-sm' />
        </div>
        <div aria-hidden className='hidden w-80 shrink-0 border-l lg:block'>
          <FormSkeleton label='正在加载编辑内容' />
        </div>
      </LoadingRegion>
    )
  }

  if (path.startsWith('/assistant')) {
    return (
      <LoadingRegion label='正在加载对话' className='flex h-full min-h-96'>
        <div className='hidden w-64 shrink-0 space-y-4 border-r p-4 md:block'>
          <p className='text-sm font-medium'>对话</p>
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className='h-9 w-full' />
          ))}
        </div>
        <div
          aria-hidden
          className='flex min-w-0 flex-1 flex-col justify-between p-6'
        >
          <ContentSkeleton
            label='正在加载消息'
            className='mx-auto w-full max-w-2xl'
            rows={2}
          />
          <Skeleton className='mx-auto h-24 w-full max-w-2xl' />
        </div>
      </LoadingRegion>
    )
  }

  return (
    <PageLayout>
      {titles[path] && <PageHeader title={titles[path]} />}
      {path === '/template' ? (
        <LoadingRegion
          label={label}
          className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        >
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className='space-y-3'>
              <PaperSkeleton className='rounded-lg border' compact />
              <Skeleton className='h-4 w-2/3' />
              <Skeleton className='h-3 w-1/3' />
            </div>
          ))}
        </LoadingRegion>
      ) : path === '/tracker' ? (
        <LoadingRegion label={label} className='min-w-0'>
          <div className='space-y-3 md:hidden'>
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className='h-20 w-full rounded-xl' />
            ))}
          </div>
          <div className='hidden gap-3 overflow-hidden md:flex'>
            {BOARD_COLUMNS.slice(0, 5).map((column) => (
              <div
                key={column.status}
                className='min-w-[232px] flex-1 space-y-4 rounded-xl bg-muted/40 p-3'
              >
                <span className='text-sm font-medium'>{column.label}</span>
                <div className='space-y-3 rounded-xl border bg-card p-4'>
                  <Skeleton className='size-8 rounded-lg' />
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-1/2' />
                </div>
              </div>
            ))}
          </div>
        </LoadingRegion>
      ) : (
        <ContentSkeleton
          label={label}
          className='rounded-xl border p-6'
          rows={path === WORKSPACE_PATH || path === '/optimize' ? 4 : 3}
        />
      )}
    </PageLayout>
  )
}
