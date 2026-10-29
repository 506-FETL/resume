import type React from 'react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useState } from 'react'
import { PresencePage } from '@/components/motion/presence-item'
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

export function DashboardShell({
  children,
  routeKey,
  fullBleed = false,
}: DashboardShellProps) {
  const reduceMotion = useReducedMotion()

  // Only application pages opt in; resume document containers keep their own layout.
  const usesPageLayout = [
    '/',
    '/resume',
    '/template',
    '/share',
    '/tracker',
    '/history',
    '/optimize',
    '/profile',
    '/changelog',
    '/login',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
  ].includes(routeKey.replace(/\/$/, '') || '/')

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('sidebarOpen') !== 'false'
    } catch {
      return true
    }
  })

  return (
    <SidebarProvider
      className='h-full min-h-0 overflow-hidden'
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
      <AppSidebar variant='floating' />
      <SidebarInset className='min-h-0 overflow-hidden'>
        {!fullBleed && (
          <header
            className={cn(
              'sticky top-0 z-1 shrink-0 border-b bg-background/95 p-2 backdrop-blur supports-backdrop-filter:bg-background/60',
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
          className={cn(
            'min-h-0 min-w-0 flex-1 outline-none',
            fullBleed
              ? 'overflow-hidden'
              : 'overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]',
            !fullBleed && !usesPageLayout && 'p-4',
          )}
          style={
            usesPageLayout || fullBleed
              ? {
                  fontFamily:
                    '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                }
              : undefined
          }
        >
          <AnimatePresence mode='wait' initial={false}>
            <PresencePage
              key={routeKey}
              initial={{ opacity: reduceMotion ? 1 : 0 }}
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
              className='h-full min-h-0 w-full'
            >
              {children}
            </PresencePage>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
