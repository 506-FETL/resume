import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from 'next-themes'
import { Suspense, useState } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { SiteHeader } from '@/components/dashboard/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { BackgroundLines } from './components/ui/background-lines'
import { LineShadowText } from './components/ui/line-shadow-text'

function App() {
  const element = useRoutes(routes)
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen')
    return saved !== null ? saved === 'true' : true
  })

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <SidebarProvider
        defaultOpen={sidebarOpen}
        open={sidebarOpen}
        onOpenChange={(open) => {
          setSidebarOpen(open)
          localStorage.setItem('sidebarOpen', String(open))
        }}
      >
        <AppSidebar variant="floating" />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-1 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) p-2">
            <SiteHeader />
          </header>
          <div className="flex-1 p-4 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
              >
                <Suspense fallback={<Loading />}>{element}</Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
          <Toaster position="top-right" richColors />
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}

function Loading() {
  const theme = useTheme()
  const shadowColor = theme.resolvedTheme === 'dark' ? 'white' : 'black'

  return (
    <BackgroundLines className="flex items-center justify-center">
      <LineShadowText shadowColor={shadowColor} className="text-xl italic">
        Loading...
      </LineShadowText>
    </BackgroundLines>
  )
}

export default App
