import { lazy, Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { AuthLayout } from '@/components/layout/auth-layout'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import {
  ContentSkeleton,
  FormSkeleton,
  LoadingRegion,
  PaperSkeleton,
} from '@/components/loading-skeleton'
import { DashboardPageSkeleton } from '@/components/page-skeletons/dashboard'
import { ResumeLibrarySkeleton } from '@/components/resume/library-skeleton'
import { WORKSPACE_PATH } from '@/lib/workspace-path'

const AssistantPageSkeleton = lazy(() =>
  import('@/components/page-skeletons/assistant').then((module) => ({
    default: module.AssistantPageSkeleton,
  })),
)

const ChangelogPageSkeleton = lazy(() =>
  import('@/components/page-skeletons/changelog').then((module) => ({
    default: module.ChangelogPageSkeleton,
  })),
)

const ExperiencePageSkeleton = lazy(() =>
  import('@/components/page-skeletons/experience').then((module) => ({
    default: module.ExperiencePageSkeleton,
  })),
)

const HistoryPageSkeleton = lazy(() =>
  import('@/components/page-skeletons/history').then((module) => ({
    default: module.HistoryPageSkeleton,
  })),
)

const OptimizePageSkeleton = lazy(() =>
  import('@/components/page-skeletons/optimize').then((module) => ({
    default: module.OptimizePageSkeleton,
  })),
)

const ProfilePageSkeleton = lazy(() =>
  import('@/components/page-skeletons/profile').then((module) => ({
    default: module.ProfilePageSkeleton,
  })),
)

const SharePageSkeleton = lazy(() =>
  import('@/components/page-skeletons/share').then((module) => ({
    default: module.SharePageSkeleton,
  })),
)

const TemplatePageSkeleton = lazy(() =>
  import('@/components/page-skeletons/template').then((module) => ({
    default: module.TemplatePageSkeleton,
  })),
)

const TrackerPageSkeleton = lazy(() =>
  import('@/components/page-skeletons/tracker').then((module) => ({
    default: module.TrackerPageSkeleton,
  })),
)

const authPages: Record<string, { title: string; rows: number }> = {
  '/login': { title: '登录', rows: 2 },
  '/sign-up': { title: '创建账户', rows: 3 },
  '/forgot-password': { title: '忘记密码', rows: 1 },
  '/reset-password': { title: '重置密码', rows: 2 },
}

const pageTitles: Record<string, string> = {
  '/template': '简历模板',
  '/tracker': '求职跟进',
  '/optimize': '简历优化',
  '/share': '分享管理',
  '/experience': '职业档案',
  '/history': '历史版本',
  '/profile': '个人信息',
  '/assistant': 'AI 助手',
  '/changelog': '更新日志',
}

function RouteSkeletonContent({
  pathname,
  label = '正在加载页面',
  guest = false,
}: {
  pathname: string
  label?: string
  guest?: boolean
}) {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/resume') return <ResumeLibrarySkeleton />
  if (path === WORKSPACE_PATH) return <DashboardPageSkeleton guest={guest} />
  if (path === '/template') return <TemplatePageSkeleton />
  if (path === '/tracker') return <TrackerPageSkeleton />
  if (path === '/optimize') return <OptimizePageSkeleton />
  if (path === '/share') return <SharePageSkeleton />
  if (path === '/experience') return <ExperiencePageSkeleton />
  if (path === '/history') return <HistoryPageSkeleton />
  if (path === '/profile') return <ProfilePageSkeleton />
  if (path.startsWith('/assistant')) return <AssistantPageSkeleton />

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
        className='relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden p-3 md:p-8'
      >
        <PaperSkeleton className='mx-auto max-w-[794px] self-start shadow-sm' />
      </LoadingRegion>
    )
  }

  const authPage = authPages[path]

  if (authPage) {
    return (
      <AuthLayout>
        <PageHeader title={authPage.title} />
        <FormSkeleton
          label={label}
          rows={authPage.rows}
          className='px-0 py-6'
        />
      </AuthLayout>
    )
  }

  if (path === '/changelog') {
    return <ChangelogPageSkeleton />
  }

  return (
    <PageLayout>
      <ContentSkeleton label={label} className='px-0' />
    </PageLayout>
  )
}

export function RouteSkeleton(
  props: Parameters<typeof RouteSkeletonContent>[0],
) {
  const title = pageTitles[`/${props.pathname.split('/')[1]}`]

  const fallback = (
    <PageLayout>
      {title && <PageHeader title={title} />}
      <ContentSkeleton label={props.label ?? '正在加载页面'} className='px-0' />
    </PageLayout>
  )

  return (
    <ErrorBoundary key={props.pathname} fallback={fallback}>
      <Suspense fallback={fallback}>
        <RouteSkeletonContent {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}
