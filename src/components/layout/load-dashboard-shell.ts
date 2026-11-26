import { preloadComponent } from '@/lib/preload-component'

export const dashboardShell = preloadComponent(() =>
  import('./dashboard-shell').then(({ DashboardShell }) => ({
    default: DashboardShell,
  })),
)
