import type React from 'react'
import { CircleUser, LogIn, LogOut, ScrollText, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createDeferredComponent } from '@/components/deferred-content'
import { LoadingStatus } from '@/components/loading-status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useCurrentUser from '@/hooks/use-current-user'
import { ChangelogIndicator } from './changelog-indicator'

const QuotaMenuRow = createDeferredComponent(
  () =>
    import('@/components/quota/quota-menu-row').then((module) => ({
      default: module.QuotaMenuRow,
    })),
  'AI 额度',
  <LoadingStatus
    label='正在读取 AI 额度'
    className='min-h-7 px-2 py-1.5 text-xs'
  />,
  { wrapFallback: false },
)

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
      const { SignOut } = await import('@/lib/supabase/user/auth')

      await SignOut()
      navigate('/login')
    } catch (error) {
      toast.error(`登出失败，请稍后重试, ${error}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        className='min-w-56 rounded-lg'
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
          <DropdownMenuItem asChild>
            <Link to='/changelog'>
              <ScrollText />
              更新日志
              <ChangelogIndicator className='ml-auto' />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user ? (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              登出
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ) : (
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
