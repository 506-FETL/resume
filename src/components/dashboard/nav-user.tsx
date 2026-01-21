'use client'

import { IconDotsVertical, IconLogin, IconLogout, IconUserCircle } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import useCurrentUser from '@/hooks/use-current-user'
import { SignOut } from '@/lib/supabase/user'
import { CurrentUserAvatar } from '../current-user-avatar'
import { Data } from './const'
import { NavSecondary } from './nav-secondary'

export function NavUser() {
  const user = useCurrentUser()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await SignOut()
      navigate('/login')
    }
    catch (error) {
      toast.error(`登出失败，请稍后重试, ${error}`)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <CurrentUserAvatar />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user ? user.user_metadata.full_name : '未登陆'}</span>
                <span className="text-muted-foreground truncate text-xs">{user ? user.email : 'resume'}</span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            {user && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <IconUserCircle />
                    账户
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            <NavSecondary items={Data.navSecondary} className="p-0" />
            <DropdownMenuSeparator />

            {user
              ? (
                  <DropdownMenuItem onClick={handleSignOut}>
                    <IconLogout />
                    登出
                  </DropdownMenuItem>
                )
              : (
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/login')
                    }}
                  >
                    <IconLogin />
                    登录
                  </DropdownMenuItem>
                )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
