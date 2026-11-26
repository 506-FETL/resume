import { useState } from 'react'
import { DashboardPageSkeleton } from '@/components/page-skeletons/dashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { SIDEBAR_WIDTH_ICON } from '@/components/ui/sidebar/sidebar-context'
import { DASHBOARD_SIDEBAR_WIDTH, readSidebarOpen } from './sidebar-preference'

export function DashboardOpening({ guest }: { guest: boolean }) {
  const [sidebarOpen] = useState(readSidebarOpen)

  return (
    <div className='flex h-full min-w-0 bg-background'>
      <div
        aria-hidden
        className='hidden shrink-0 border-r border-sidebar-border bg-sidebar px-3 py-5 md:block'
        style={{
          width: sidebarOpen ? DASHBOARD_SIDEBAR_WIDTH : SIDEBAR_WIDTH_ICON,
        }}
      >
        <Skeleton className='h-5 w-full max-w-24' />
      </div>
      <main className='flex min-w-0 flex-1 flex-col'>
        <div
          aria-hidden
          className='flex min-h-14 items-center gap-3 border-b border-border/70 px-4'
        >
          <Skeleton className='size-4' />
          <Skeleton className='h-3 w-8' />
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]'>
          <DashboardPageSkeleton guest={guest} />
        </div>
      </main>
    </div>
  )
}
