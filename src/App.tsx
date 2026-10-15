import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { MotionProvider } from '@/components/motion/motion-provider'
import { PageLoading } from '@/components/page-loading'
import { UpgradeDialog } from '@/components/quota/upgrade-dialog'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { DURATION, EASE } from '@/lib/motion'
import { useRecoveryNavigation } from '@/pages/reset-password/hooks/use-recovery-navigation'

function App() {
  const element = useRoutes(routes)
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const recoveryPending = useRecoveryNavigation()
  const isAssistantRoute
    = location.pathname === '/assistant'
      || location.pathname.startsWith('/assistant/')
  const isShareViewRoute = location.pathname.startsWith('/share/view/')

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
                  <DashboardShell routeKey={location.pathname} fullBleed={isAssistantRoute}>
                    <Suspense fallback={<PageLoading />}>{recoveryPending ? <PageLoading /> : element}</Suspense>
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
