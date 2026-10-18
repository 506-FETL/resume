import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { AuthRequired } from '@/components/auth-required'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { MotionProvider } from '@/components/motion/motion-provider'
import { PageLoading } from '@/components/page-loading'
import { UpgradeDialog } from '@/components/quota/upgrade-dialog'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { DURATION, EASE } from '@/lib/motion'
import { useRecoveryNavigation } from '@/pages/reset-password/hooks/use-recovery-navigation'
import useUserStore from '@/store/user'

const ACCOUNT_PAGES: Record<string, { title: string, description: string }> = {
  '/tracker': { title: '登录后管理求职进展', description: '记录投递职位、跟进面试进度，并同步你的求职记录。' },
  '/share': { title: '登录后管理分享链接', description: '创建和管理简历分享链接，查看访问记录与分享状态。' },
  '/history': { title: '登录后查看历史版本', description: '查看云端简历的版本记录，对比修改并恢复历史内容。' },
  '/assistant': { title: '登录后使用 AI 助手', description: '与 AI 助手一起完善简历、管理求职进展，并保存对话记录。' },
  '/optimize': { title: '登录后优化简历', description: '选择简历进行 ATS 检测，获取优化建议并保存分析报告。' },
}

function App() {
  const element = useRoutes(routes)
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const recoveryPending = useRecoveryNavigation()
  const authStatus = useUserStore(state => state.authStatus)
  const isAssistantRoute
    = location.pathname === '/assistant'
      || location.pathname.startsWith('/assistant/')
  const isShareViewRoute = location.pathname.startsWith('/share/view/')
  const accountPage = ACCOUNT_PAGES[location.pathname.replace(/\/+$/, '')]
  const page = accountPage ? <AuthRequired {...accountPage}>{element}</AuthRequired> : element

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MotionProvider>
        <AnimatePresence mode="wait">
          <motion.div
            key={isShareViewRoute ? 'share' : 'dashboard'}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
            transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
            className="h-dvh w-full"
          >
            {isShareViewRoute
              ? <Suspense fallback={<PageLoading />}>{recoveryPending ? <PageLoading /> : element}</Suspense>
              : (
                  <DashboardShell routeKey={location.pathname} fullBleed={isAssistantRoute && authStatus === 'authenticated'}>
                    <Suspense fallback={<PageLoading />}>{recoveryPending ? <PageLoading /> : page}</Suspense>
                  </DashboardShell>
                )}
          </motion.div>
        </AnimatePresence>
        <Toaster position="top-right" richColors />
        <UpgradeDialog />
      </MotionProvider>
    </ThemeProvider>
  )
}

export default App
