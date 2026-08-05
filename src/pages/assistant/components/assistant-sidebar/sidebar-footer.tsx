import { EllipsisVertical } from 'lucide-react'
import { CurrentUserAvatar } from '@/components/current-user-avatar'
import { AccountMenu } from '@/components/dashboard/account-menu'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import useCurrentUser from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'

interface AssistantSidebarFooterProps {
  expanded: boolean
}

export function AssistantSidebarFooter({ expanded }: AssistantSidebarFooterProps) {
  const user = useCurrentUser()
  const name = user?.user_metadata.full_name || '未登录'

  return (
    <div
      className={cn(
        'mt-auto flex shrink-0 items-center gap-2 border-t p-3',
        !expanded && 'flex-col',
      )}
    >
      <AccountMenu side="right" align="end">
        <Button
          variant="ghost"
          size={expanded ? 'default' : 'icon-sm'}
          className={expanded ? 'h-10 min-w-0 flex-1 justify-start rounded-xl px-2' : 'rounded-xl'}
          aria-label="账户菜单"
        >
          <CurrentUserAvatar className="size-7" />
          {expanded && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium">{name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{user?.email || '登录后同步对话'}</p>
              </div>
              <EllipsisVertical className="text-muted-foreground" />
            </>
          )}
        </Button>
      </AccountMenu>
      {expanded
        ? <AnimatedThemeToggler className="size-8 rounded-xl" aria-label="切换主题" />
        : (
            <Tooltip>
              <TooltipTrigger asChild>
                <AnimatedThemeToggler className="size-8 rounded-xl" aria-label="切换主题" />
              </TooltipTrigger>
              <TooltipContent side="right">切换主题</TooltipContent>
            </Tooltip>
          )}
    </div>
  )
}
