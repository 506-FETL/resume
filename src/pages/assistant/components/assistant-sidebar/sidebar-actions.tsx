import { ArrowLeft, MessageSquarePlus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'

interface AssistantSidebarActionsProps {
  expanded: boolean
}

const ACTION_CLASSNAME = 'h-9 justify-start rounded-xl'

export function AssistantSidebarActions({ expanded }: AssistantSidebarActionsProps) {
  const { returnToWorkspace, startNewConversation } = useAssistantNavigation()
  const openSearch = () => useAssistantStore.setState({
    mobileSidebarOpen: false,
    searchOpen: true,
  })

  const actions = [
    { label: '返回工作台', icon: ArrowLeft, onClick: returnToWorkspace },
    { label: '新建对话', icon: MessageSquarePlus, onClick: startNewConversation },
    { label: '搜索历史', icon: Search, onClick: openSearch, shortcut: '⌘K' },
  ]

  return (
    <div className="flex shrink-0 flex-col gap-1.5 p-3">
      {actions.map(({ label, icon: Icon, onClick, shortcut }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              variant={label === '新建对话' ? 'outline' : 'ghost'}
              size={expanded ? 'sm' : 'icon-sm'}
              className={expanded ? ACTION_CLASSNAME : 'rounded-xl'}
              aria-label={label}
              onClick={onClick}
            >
              <Icon />
              {expanded && (
                <>
                  <span>{label}</span>
                  {shortcut && <kbd className="ml-auto text-[10px] text-muted-foreground">{shortcut}</kbd>}
                </>
              )}
            </Button>
          </TooltipTrigger>
          {!expanded && <TooltipContent side="right">{label}</TooltipContent>}
        </Tooltip>
      ))}
    </div>
  )
}
