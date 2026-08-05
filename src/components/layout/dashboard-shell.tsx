import type React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { SiteHeader } from '@/components/dashboard/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

interface DashboardShellProps {
  children: React.ReactNode
  routeKey: string
}

export function DashboardShell({ children, routeKey }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('sidebarOpen') !== 'false'
    }
    catch {
      return true
    }
  })

  return (
    <SidebarProvider
      defaultOpen={sidebarOpen}
      open={sidebarOpen}
      onOpenChange={(open) => {
        setSidebarOpen(open)
        try {
          localStorage.setItem('sidebarOpen', String(open))
        }
        catch {
          // Keep the in-memory preference when storage is unavailable.
        }
      }}
    >
      <AppSidebar variant="floating" />
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-1 border-b bg-background/95 p-2 backdrop-blur transition-[width,height] ease-linear supports-backdrop-filter:bg-background/60 group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
          <SiteHeader />
        </header>
        <div className="min-w-0 flex-1 overflow-clip p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
