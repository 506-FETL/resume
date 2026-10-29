import { Search, SquarePen } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { DURATION, EASE } from '@/lib/motion'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'
import ConversationList from '../conversation-list'

export default function ConversationNavigation() {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const { startNewConversation, openSearch } = useAssistantNavigation()
  const initializing = useAssistantStore((state) => state.initializing)
  const reduceMotion = useReducedMotion()
  const expanded = isMobile || state === 'expanded'

  return (
    <>
      <SidebarGroup className='shrink-0'>
        <SidebarGroupLabel>对话</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip='新建对话'
              aria-label='新建对话'
              disabled={initializing}
              onClick={startNewConversation}
            >
              <SquarePen />
              <span>新建对话</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip='搜索历史'
              aria-label='搜索历史'
              onClick={openSearch}
            >
              <Search />
              <span>搜索历史</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key='conversation-list'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                duration: reduceMotion ? 0 : DURATION.fast,
                ease: EASE.in,
              },
            }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            className='flex min-h-0 flex-1 flex-col overflow-hidden'
          >
            <ConversationList onNavigate={() => setOpenMobile(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
