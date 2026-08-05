'use client'

import { EllipsisVertical } from 'lucide-react'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import useCurrentUser from '@/hooks/use-current-user'
import { CurrentUserAvatar } from '../current-user-avatar'
import { AccountMenu } from './account-menu'

export function NavUser() {
  const user = useCurrentUser()
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <AccountMenu side={isMobile ? 'bottom' : 'right'}>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <CurrentUserAvatar />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user ? user.user_metadata.full_name : '未登录'}</span>
              <span className="truncate text-xs text-muted-foreground">{user ? user.email : 'resume'}</span>
            </div>
            <EllipsisVertical className="ml-auto size-4" />
          </SidebarMenuButton>
        </AccountMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
