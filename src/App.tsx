import { AnimatePresence, motion } from 'motion/react'
import { Suspense, useState } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { SiteHeader } from '@/components/dashboard/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'

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
  return (
    <div className="w-full h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-md animate-in fade-in-50 duration-500">
        {/* 简单的内容预览 */}
        <div className="w-full space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
