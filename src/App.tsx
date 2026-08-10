import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { AssistantShell } from '@/components/layout/assistant-shell'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { UpgradeDialog } from '@/components/quota/upgrade-dialog'
import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { BackgroundLines } from './components/ui/background-lines'
import { LineShadowText } from './components/ui/line-shadow-text'

function App() {
  const element = useRoutes(routes)
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const isAssistantRoute
    = location.pathname === '/assistant'
      || location.pathname.startsWith('/assistant/')

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AnimatePresence mode="wait">
        <motion.div
          key={isAssistantRoute ? 'assistant' : 'dashboard'}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="h-dvh w-full"
        >
          {isAssistantRoute
            ? (
                <AssistantShell>
                  <Suspense fallback={<Loading />}>{element}</Suspense>
                </AssistantShell>
              )
            : (
                <DashboardShell routeKey={location.pathname}>
                  <Suspense fallback={<Loading />}>{element}</Suspense>
                </DashboardShell>
              )}
        </motion.div>
      </AnimatePresence>
      <Toaster position="top-right" richColors />
      <UpgradeDialog />
    </ThemeProvider>
  )
}

function Loading() {
  const { resolvedTheme } = useTheme()
  const shadowColor = resolvedTheme === 'dark' ? 'white' : 'black'

  return (
    <BackgroundLines className="flex items-center justify-center">
      <LineShadowText shadowColor={shadowColor} className="text-xl italic">
        Loading...
      </LineShadowText>
    </BackgroundLines>
  )
}

export default App
