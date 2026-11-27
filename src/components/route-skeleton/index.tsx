import { PageLoading } from '@/components/page-loading'
import { AuthLayout } from '@/components/layout/auth-layout'
import { PageHeader } from '@/components/layout/page-layout'
import {
  FormSkeleton,
  LoadingRegion,
  PaperSkeleton,
} from '@/components/loading-skeleton'
import { AssistantPageSkeleton } from '@/components/page-skeletons/assistant'
import { ChangelogPageSkeleton } from '@/components/page-skeletons/changelog'
import { DashboardPageSkeleton } from '@/components/page-skeletons/dashboard'
import {
  ExperiencePageSkeleton,
  ExperienceReadingSkeleton,
} from '@/components/page-skeletons/experience'
import { getExperienceTarget } from '@/lib/experience-route'
import type { ExperienceLocationState } from '@/pages/experience/types'
import { HistoryPageSkeleton } from '@/components/page-skeletons/history'
import { OptimizePageSkeleton } from '@/components/page-skeletons/optimize'
import { ProfilePageSkeleton } from '@/components/page-skeletons/profile'
import { SharePageSkeleton } from '@/components/page-skeletons/share'
import { TemplatePageSkeleton } from '@/components/page-skeletons/template'
import { TrackerPageSkeleton } from '@/components/page-skeletons/tracker'
import { ResumeLibrarySkeleton } from '@/components/resume/library-skeleton'
import { WORKSPACE_PATH } from '@/lib/workspace-path'

const authPages: Record<string, { title: string; rows: number }> = {
  '/login': { title: '登录', rows: 2 },
  '/sign-up': { title: '创建账户', rows: 3 },
  '/forgot-password': { title: '忘记密码', rows: 1 },
  '/reset-password': { title: '重置密码', rows: 2 },
}

// 骨架随外壳就绪，避免先显示通用占位、再切换页面骨架。
export function RouteSkeleton({
  pathname,
  label = '正在加载页面',
  guest = false,
  location,
  shellPending = false,
}: {
  pathname: string
  label?: string
  guest?: boolean
  shellPending?: boolean
  location?: { search: string; state: ExperienceLocationState | null }
}) {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/resume') return <ResumeLibrarySkeleton />
  if (path === WORKSPACE_PATH) return <DashboardPageSkeleton guest={guest} />
  if (path === '/template') return <TemplatePageSkeleton />
  if (path === '/tracker') return <TrackerPageSkeleton />
  if (path === '/optimize') return <OptimizePageSkeleton />
  if (path === '/share') return <SharePageSkeleton />
  if (path === '/experience') {
    return location && getExperienceTarget(location.search, location.state) ? (
      <ExperienceReadingSkeleton />
    ) : (
      <ExperiencePageSkeleton />
    )
  }
  if (path === '/history') return <HistoryPageSkeleton />
  if (path === '/profile') return <ProfilePageSkeleton />
  if (path.startsWith('/assistant'))
    return <AssistantPageSkeleton shellPending={shellPending} />

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
          className='px-0 pt-(--page-section-gap)'
        />
      </AuthLayout>
    )
  }

  if (path === '/changelog') {
    return <ChangelogPageSkeleton />
  }

  return <PageLoading label={label} />
}
