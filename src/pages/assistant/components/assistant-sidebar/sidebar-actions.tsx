import { ArrowLeft, Search, SquarePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'

interface AssistantSidebarActionsProps {
  expanded: boolean
}

export function AssistantSidebarActions({ expanded }: AssistantSidebarActionsProps) {
  const { returnToWorkspace, startNewConversation } = useAssistantNavigation()
  const openSearch = () => useAssistantStore.setState({
    mobileSidebarOpen: false,
    searchOpen: true,
  })

  // 折叠态：仅图标竖排 + Tooltip
  if (!expanded) {
    const items = [
      { label: '返回工作台', icon: ArrowLeft, onClick: returnToWorkspace, primary: false },
      { label: '新建对话', icon: SquarePen, onClick: startNewConversation, primary: true },
      { label: '搜索历史', icon: Search, onClick: openSearch, primary: false },
    ]
    return (
      <div className="flex shrink-0 flex-col items-center gap-1 p-2.5">
        {items.map(({ label, icon: Icon, onClick, primary }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={primary
                  ? 'rounded-lg border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:text-primary dark:bg-primary/10 dark:hover:bg-primary/15'
                  : 'rounded-lg text-muted-foreground hover:text-foreground'}
                aria-label={label}
                onClick={onClick}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    )
  }

  // 展开态：返回=轻链接 / 新建=克制主 CTA / 搜索=融入式搜索行
  return (
    <div className="flex shrink-0 flex-col gap-2 px-2.5 pt-1 pb-2">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-1 h-7 justify-start gap-1 self-start rounded-md px-1.5 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-label="返回工作台"
        onClick={returnToWorkspace}
      >
        <ArrowLeft className="size-3.5" />
        返回工作台
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-10 w-full justify-start gap-2 rounded-xl border-primary/20 bg-primary/[0.06] font-medium text-primary shadow-none hover:bg-primary/10 hover:text-primary dark:bg-primary/10 dark:hover:bg-primary/15"
        aria-label="新建对话"
        onClick={startNewConversation}
      >
        <SquarePen className="size-4" />
        <span>新建对话</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-start gap-2 rounded-xl bg-muted/40 px-2.5 font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="搜索历史"
        onClick={openSearch}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">搜索历史</span>
        <Kbd>⌘K</Kbd>
      </Button>
    </div>
  )
}
