import type React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { SiteHeader } from '@/components/dashboard/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  children: React.ReactNode
  routeKey: string
  fullBleed?: boolean
}

export function DashboardShell({ children, routeKey, fullBleed = false }: DashboardShellProps) {
  const reduceMotion = useReducedMotion()
  // Opt-in avoids changing the template workbench and resume document containers.
  const usesPageLayout = ['/', '/resume', '/share', '/tracker', '/history', '/optimize', '/profile', '/changelog', '/login', '/sign-up', '/forgot-password', '/reset-password'].includes(routeKey.replace(/\/$/, '') || '/')
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
      className="h-full min-h-0 overflow-hidden"
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
      <SidebarInset className="min-h-0 overflow-hidden">
        {!fullBleed && (
          <header className="sticky top-0 z-1 shrink-0 border-b bg-background/95 p-2 backdrop-blur transition-[width,height] ease-linear supports-backdrop-filter:bg-background/60 group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <SiteHeader />
          </header>
        )}
        <div
          className={cn('min-h-0 min-w-0 flex-1', fullBleed ? 'overflow-hidden' : 'overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]', !fullBleed && !usesPageLayout && 'p-4')}
          style={usesPageLayout || fullBleed ? { fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' } : undefined}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
              transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
              className="h-full min-h-0 w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
