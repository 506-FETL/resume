import { LoaderCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { MotionProvider } from '@/components/motion/motion-provider'
import { UpgradeDialog } from '@/components/quota/upgrade-dialog'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

function App() {
  const element = useRoutes(routes)
  const location = useLocation()
  const reduceMotion = useReducedMotion()
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
              ? <Suspense fallback={<Loading />}>{element}</Suspense>
              : (
                  <DashboardShell routeKey={location.pathname} fullBleed={isAssistantRoute}>
                    <Suspense fallback={<Loading />}>{element}</Suspense>
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

function Loading() {
  const reduceMotion = useReducedMotion()

  return (
    <div role="status" className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden className={cn('size-4', !reduceMotion && 'animate-spin')} />
      正在加载…
    </div>
  )
}

export default App
