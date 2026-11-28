import { useState } from 'react'
import type { ReactNode } from 'react'
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs'
import { cn } from '@/lib/utils'
import { SIDEBAR_WIDTH_ICON } from '@/components/ui/sidebar/sidebar-context'
import { DASHBOARD_SIDEBAR_WIDTH, readSidebarOpen } from './sidebar-preference'

export function DashboardOpening({
  children,
  fullBleed = false,
}: {
  children: ReactNode
  fullBleed?: boolean
}) {
  const crumbs = useBreadcrumbs()
  const [sidebarOpen] = useState(readSidebarOpen)

  return (
    <div className='flex h-full min-w-0 bg-background'>
      <div
        className='hidden shrink-0 border-r border-sidebar-border bg-sidebar md:block'
        style={{
          width: sidebarOpen ? DASHBOARD_SIDEBAR_WIDTH : SIDEBAR_WIDTH_ICON,
        }}
      >
        <a
          href='/'
          aria-label='GResume 展示首页'
          className={cn(
            'flex h-16 items-center gap-2.5 text-lg font-semibold tracking-tight',
            sidebarOpen ? 'px-5' : 'justify-center',
          )}
        >
          <img src='/favicon.svg' alt='' className='size-5 shrink-0' />
          {sidebarOpen && 'GResume'}
        </a>
      </div>
      <main className='flex min-w-0 flex-1 flex-col'>
        {!fullBleed && (
          <div className='flex min-h-14 items-center border-b border-border/70 px-4 text-sm text-muted-foreground'>
            {crumbs.at(-1)?.label}
          </div>
        )}
        <div
          className={
            fullBleed
              ? 'min-h-0 flex-1 overflow-hidden'
              : 'min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]'
          }
        >
          {children}
        </div>
      </main>
    </div>
  )
}
