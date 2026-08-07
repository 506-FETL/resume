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
        'mt-auto flex shrink-0 items-center gap-1.5 border-t border-border/60 p-2.5',
        !expanded && 'flex-col',
      )}
    >
      {/* 展开态（含移动端抽屉）：底部锚点，向上弹出并左对齐，避免向右溢出屏幕；收起态窄栏：向右弹出 */}
      <AccountMenu side={expanded ? 'top' : 'right'} align={expanded ? 'start' : 'end'}>
        <Button
          variant="ghost"
          size={expanded ? 'default' : 'icon-sm'}
          className={expanded ? 'h-11 min-w-0 flex-1 justify-start rounded-lg px-2' : 'rounded-lg'}
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
        ? <AnimatedThemeToggler className="size-8 rounded-lg text-muted-foreground hover:text-foreground" aria-label="切换主题" />
        : (
            <Tooltip>
              <TooltipTrigger asChild>
                <AnimatedThemeToggler className="size-8 rounded-lg text-muted-foreground hover:text-foreground" aria-label="切换主题" />
              </TooltipTrigger>
              <TooltipContent side="right">切换主题</TooltipContent>
            </Tooltip>
          )}
    </div>
  )
}
