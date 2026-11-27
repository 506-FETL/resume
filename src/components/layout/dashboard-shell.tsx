import type React from 'react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useState } from 'react'
import { PresencePage } from '@/components/motion/presence-item'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { Data } from '@/components/dashboard/const'
import { SiteHeader } from '@/components/dashboard/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DASHBOARD_SIDEBAR_WIDTH, readSidebarOpen } from './sidebar-preference'

interface DashboardShellProps {
  children: React.ReactNode
  routeKey: string
  fullBleed?: boolean
}

export function DashboardShell({
  children,
  routeKey,
  fullBleed = false,
}: DashboardShellProps) {
  const reduceMotion = useReducedMotion()

  const path = routeKey.replace(/\/$/, '')

  const sidebarPage =
    path === '/assistant' || Data.modules.some(({ url }) => url === path)

  const usesPageLayout =
    sidebarPage ||
    [
      '/profile',
      '/changelog',
      '/login',
      '/sign-up',
      '/forgot-password',
      '/reset-password',
    ].includes(path)

  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)

  return (
    <SidebarProvider
      className='h-full min-h-0 overflow-hidden'
      style={
        { '--sidebar-width': DASHBOARD_SIDEBAR_WIDTH } as React.CSSProperties
      }
      defaultOpen={sidebarOpen}
      open={sidebarOpen}
      onOpenChange={(open) => {
        setSidebarOpen(open)

        try {
          localStorage.setItem('sidebarOpen', String(open))
        } catch {
          // Keep the in-memory preference when storage is unavailable.
        }
      }}
    >
      <AppSidebar variant='sidebar' />
      <SidebarInset className='min-h-0 overflow-hidden'>
        {!fullBleed && (
          <header
            className={cn(
              'sticky top-0 z-1 flex min-h-14 shrink-0 items-center border-b border-border/70 bg-background p-2',
              !sidebarOpen &&
                (routeKey.startsWith('/resume/editor')
                  ? 'md:h-auto'
                  : 'md:h-(--header-height)'),
            )}
          >
            <SiteHeader />
          </header>
        )}
        <div
          tabIndex={-1}
          aria-label='页面内容'
          role='region'
          className='relative isolate min-h-0 min-w-0 flex-1 overflow-hidden outline-none'
          style={
            usesPageLayout || fullBleed
              ? {
                  fontFamily:
                    '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                }
              : undefined
          }
        >
          <AnimatePresence mode={sidebarPage ? 'sync' : 'wait'} initial={false}>
            <PresencePage
              key={routeKey}
              initial={reduceMotion ? false : { opacity: 0 }}
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
              className={cn(
                'absolute inset-0 z-1 bg-background [&[inert]]:z-0 motion-reduce:opacity-100! motion-reduce:[&[inert]]:hidden',
                fullBleed
                  ? 'overflow-hidden'
                  : 'overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]',
                !fullBleed && !usesPageLayout && 'p-4',
              )}
            >
              {/* 页内列表和表单只处理自己的进出，由外层独立完成路由退场。 */}
              <AnimatePresence initial={false}>{children}</AnimatePresence>
            </PresencePage>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
