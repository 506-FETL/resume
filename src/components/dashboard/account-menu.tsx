import type React from 'react'
import { CircleUser, LogIn, LogOut, ScrollText, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { QuotaMenuRow } from '@/components/quota/quota-menu-row'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useCurrentUser from '@/hooks/use-current-user'
import { SignOut } from '@/lib/supabase/user'

interface AccountMenuProps {
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function AccountMenu({
  children,
  side = 'right',
  align = 'end',
}: AccountMenuProps) {
  const user = useCurrentUser()
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={8}
      >
        {user && (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <CircleUser />
              账户
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        {user && (
          <>
            <QuotaMenuRow />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings />
            设置
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/changelog')}>
            <ScrollText />
            更新日志
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user
          ? (
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut />
                  登出
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )
          : (
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate('/login')}>
                  <LogIn />
                  登录
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
