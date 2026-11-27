import { deferDialog } from '@/components/deferred-dialog'
import { useSidebar } from '../sidebar-context'
import type { MobileSidebarProps } from './types'

const Navigation = deferDialog(() => import('./index'), '主导航')

export const preloadMobileNavigation = Navigation.preload

export function MobileSidebarDeferred(props: MobileSidebarProps) {
  const { openMobile, setOpenMobile } = useSidebar()

  return (
    <Navigation open={openMobile} onClose={() => setOpenMobile(false)}>
      {(Panel) => <Panel {...props} />}
    </Navigation>
  )
}
