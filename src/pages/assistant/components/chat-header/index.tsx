import { useShallow } from 'zustand/react/shallow'
import { PanelRight } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import useAssistantStore from '../../store'
import { readableConversationTitle } from '../../composer-references'

export default function ChatHeader() {
  const {
    activeConversationId,
    conversations,
    canvasOpen,
    setCanvasOpen,
    setCanvasMobileOpen,
    layoutMode,
    canvasMobileOpen,
  } = useAssistantStore(
    useShallow((state) => ({
      activeConversationId: state.activeConversationId,
      conversations: state.conversations,
      canvasOpen: state.canvasOpen,
      setCanvasOpen: state.setCanvasOpen,
      setCanvasMobileOpen: state.setCanvasMobileOpen,
      layoutMode: state.layoutMode,
      canvasMobileOpen: state.canvasMobileOpen,
    })),
  )

  const isMobile = layoutMode === 'drawer'

  const title =
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    )?.title ?? '新对话'

  return (
    <header className='flex h-16 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-5'>
      <SidebarTrigger aria-label='切换侧边栏' />
      <div className='min-w-0 flex-1'>
        <h1 className='truncate text-base font-semibold tracking-tight'>
          {readableConversationTitle(title)}
        </h1>
      </div>
      <AnimatedThemeToggler aria-label='切换主题' />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon-sm'
            className='ml-auto'
            id='assistant-canvas-trigger'
            aria-label={!isMobile && canvasOpen ? '收起画布' : '打开画布'}
            aria-expanded={isMobile ? canvasMobileOpen : canvasOpen}
            onClick={() =>
              isMobile ? setCanvasMobileOpen(true) : setCanvasOpen(!canvasOpen)
            }
          >
            <PanelRight />
          </Button>
        </TooltipTrigger>
        <TooltipContent>画布</TooltipContent>
      </Tooltip>
    </header>
  )
}
