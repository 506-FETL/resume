import { Suspense } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { AssistantShell } from '@/components/layout/assistant-shell'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { BackgroundLines } from './components/ui/background-lines'
import { LineShadowText } from './components/ui/line-shadow-text'

function App() {
  const element = useRoutes(routes)
  const location = useLocation()
  const isAssistantRoute
    = location.pathname === '/assistant'
      || location.pathname.startsWith('/assistant/')

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
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
      <Toaster position="top-right" richColors />
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
