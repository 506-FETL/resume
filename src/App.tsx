import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { AuthRequired } from '@/components/auth-required'
import { PresencePage } from '@/components/motion/presence-item'
import { MotionProvider } from '@/components/motion/motion-provider'
import { dashboardShell } from '@/components/layout/load-dashboard-shell'
import { DashboardOpening } from '@/components/layout/dashboard-opening'
import { PageLoading } from '@/components/page-loading'
import { RouteSkeleton } from '@/components/route-skeleton'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { DURATION, EASE } from '@/lib/motion'
import {
  isResumeLibrary,
  selectResumeLibrary,
} from '@/lib/resume-library-route'
import { hasAuthCallback } from '@/lib/auth/recovery-callback'
import useUpgradeDialogStore from '@/store/upgrade-dialog'
import useUserStore from '@/store/user'
import {
  isWorkspaceHome,
  selectWorkspaceData,
} from '@/lib/workspace-data-route'

const DeferredDashboardShell = lazy(dashboardShell.load)

const JobContextGate = lazy(() =>
  import('@/components/job-context').then((module) => ({
    default: module.JobContextGate,
  })),
)

const UpgradeDialog = lazy(() =>
  import('@/components/quota/upgrade-dialog').then((module) => ({
    default: module.UpgradeDialog,
  })),
)

const loadAuthSession = () => import('@/components/auth-session')

const loadRecoveryGate = () =>
  import('@/pages/reset-password/components/recovery-gate')

const ACCOUNT_PAGES: Record<string, { title: string; description: string }> = {
  '/tracker': {
    title: '登录后管理求职进展',
    description: '记录投递职位、跟进面试进度，并同步你的求职记录。',
  },
  '/share': {
    title: '登录后管理分享链接',
    description: '创建和管理简历分享链接，查看访问记录与分享状态。',
  },
  '/history': {
    title: '登录后查看历史版本',
    description: '查看云端简历的版本记录，对比修改并恢复历史内容。',
  },
  '/experience': {
    title: '登录后管理职业档案',
    description: '保存职业背景、工作经历和项目资料',
  },
  '/assistant': {
    title: '登录后使用 AI 助手',
    description: '与 AI 助手一起完善简历、管理求职进展，并保存对话记录。',
  },
  '/optimize': {
    title: '登录后优化简历',
    description: '选择简历进行 ATS 检测，获取优化建议并保存分析报告。',
  },
}

function App() {
  const [DashboardShell] = useState(
    () => dashboardShell.ready ?? DeferredDashboardShell,
  )

  const [AuthSession] = useState(() => lazy(loadAuthSession))
  const [RecoveryGate] = useState(() => lazy(loadRecoveryGate))

  const element = useRoutes(routes)
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const upgradeOpen = useUpgradeDialogStore((state) => state.open)
  const [upgradeMounted, setUpgradeMounted] = useState(false)

  useEffect(() => {
    if (upgradeOpen) setUpgradeMounted(true)
  }, [upgradeOpen])

  const authStatus = useUserStore((state) => state.authStatus)

  useEffect(() => {
    const home = isWorkspaceHome(location.pathname)

    if (!home || !hasAuthCallback) selectWorkspaceData(home)
  }, [location.pathname])

  useEffect(() => {
    const library = isResumeLibrary(location.pathname)

    selectResumeLibrary(
      library &&
        !hasAuthCallback &&
        !new URLSearchParams(location.search).get('jobId'),
    )
  }, [location.pathname, location.search])

  const isAssistantRoute =
    location.pathname === '/assistant' ||
    location.pathname.startsWith('/assistant/')

  const isShareViewRoute = location.pathname.startsWith('/share/view/')
  const accountPage = ACCOUNT_PAGES[location.pathname.replace(/\/+$/, '')]

  const contextualElement =
    ['/resume', '/resume/editor', '/optimize', '/history', '/share'].includes(
      location.pathname.replace(/\/+$/, ''),
    ) && new URLSearchParams(location.search).has('jobId') ? (
      <JobContextGate>{element}</JobContextGate>
    ) : (
      element
    )

  const page = accountPage ? (
    <AuthRequired {...accountPage}>{contextualElement}</AuthRequired>
  ) : (
    contextualElement
  )

  const guardedPage = hasAuthCallback ? (
    <RecoveryGate>{page}</RecoveryGate>
  ) : (
    page
  )

  return (
    <ThemeProvider defaultTheme='system' storageKey='vite-ui-theme'>
      <MotionProvider>
        <Suspense fallback={null}>
          <AuthSession />
        </Suspense>
        <div tabIndex={-1} className='h-dvh w-full outline-none'>
          <AnimatePresence mode='wait' initial={false}>
            <PresencePage
              key={isShareViewRoute ? 'share' : 'dashboard'}
              initial={{ opacity: reduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: {
                  duration: reduceMotion ? 0 : DURATION.fast,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
              }}
              className='h-dvh w-full'
            >
              {isShareViewRoute ? (
                <Suspense
                  fallback={
                    <RouteSkeleton
                      pathname={location.pathname}
                      guest={authStatus === 'anonymous'}
                    />
                  }
                >
                  {guardedPage}
                </Suspense>
              ) : (
                <Suspense
                  fallback={
                    isWorkspaceHome(location.pathname) ||
                    isResumeLibrary(location.pathname) ? (
                      <DashboardOpening>
                        <RouteSkeleton
                          pathname={location.pathname}
                          guest={authStatus === 'anonymous'}
                        />
                      </DashboardOpening>
                    ) : (
                      <PageLoading label='正在打开工作台' />
                    )
                  }
                >
                  <DashboardShell
                    routeKey={location.pathname}
                    fullBleed={isAssistantRoute && authStatus !== 'anonymous'}
                  >
                    <Suspense
                      fallback={
                        <RouteSkeleton
                          pathname={location.pathname}
                          guest={authStatus === 'anonymous'}
                        />
                      }
                    >
                      {guardedPage}
                    </Suspense>
                  </DashboardShell>
                </Suspense>
              )}
            </PresencePage>
          </AnimatePresence>
        </div>
        <Toaster position='top-right' richColors />
        {!isShareViewRoute && (upgradeOpen || upgradeMounted) && (
          <Suspense fallback={null}>
            <UpgradeDialog />
          </Suspense>
        )}
      </MotionProvider>
    </ThemeProvider>
  )
}

export default App
