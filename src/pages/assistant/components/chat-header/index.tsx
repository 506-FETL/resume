import { PanelRight } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION } from '@/lib/motion'
import useAssistantStore from '../../store'

export default function ChatHeader() {
  const {
    activeConversationId,
    conversations,
    canvasOpen,
    setCanvasOpen,
    setCanvasMobileOpen,
  } = useAssistantStore()
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const title = conversations.find(conversation => conversation.id === activeConversationId)?.title ?? '新对话'

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
      <SidebarTrigger aria-label="切换侧边栏" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
        <p className="text-[11px] text-muted-foreground">AI 求职助手</p>
      </div>
      <AnimatedThemeToggler aria-label="切换主题" duration={reduceMotion ? 0 : DURATION.slow * 1000} />
      {(isMobile || !canvasOpen) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="切换画布"
              onClick={() => (isMobile ? setCanvasMobileOpen(true) : setCanvasOpen(!canvasOpen))}
            >
              <PanelRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>画布</TooltipContent>
        </Tooltip>
      )}
    </header>
  )
}
