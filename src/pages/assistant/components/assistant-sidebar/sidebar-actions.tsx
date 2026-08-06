import { ArrowLeft, MessageSquarePlus, Search } from 'lucide-react'
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
      { label: '返回工作台', icon: ArrowLeft, onClick: returnToWorkspace },
      { label: '新建对话', icon: MessageSquarePlus, onClick: startNewConversation },
      { label: '搜索历史', icon: Search, onClick: openSearch },
    ]
    return (
      <div className="flex shrink-0 flex-col items-center gap-1.5 p-3">
        {items.map(({ label, icon: Icon, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant={label === '新建对话' ? 'default' : 'ghost'}
                size="icon-sm"
                className="rounded-xl"
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

  // 展开态（C1）：返回=轻链接 / 新建=主 CTA / 搜索=类搜索框 pill
  return (
    <div className="flex shrink-0 flex-col gap-2 p-3 pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 justify-start gap-1.5 self-start rounded-lg px-2 text-muted-foreground hover:text-foreground"
        aria-label="返回工作台"
        onClick={returnToWorkspace}
      >
        <ArrowLeft className="size-4" />
        <span className="text-xs font-medium">返回工作台</span>
      </Button>

      <Button
        size="sm"
        className="h-9 w-full justify-start gap-2 rounded-xl"
        aria-label="新建对话"
        onClick={startNewConversation}
      >
        <MessageSquarePlus className="size-4" />
        <span>新建对话</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start gap-2 rounded-xl font-normal text-muted-foreground"
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
