import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'
import ConversationList from '../conversation-list'
import { AssistantSidebarActions } from './sidebar-actions'
import { AssistantSidebarFooter } from './sidebar-footer'
import { AssistantSidebarHeader } from './sidebar-header'

function SidebarBody({ expanded, mobile = false }: { expanded: boolean, mobile?: boolean }) {
  const { toggleSidebar } = useAssistantNavigation()

  return (
    <>
      {!mobile && <AssistantSidebarHeader expanded={expanded} onToggle={toggleSidebar} />}
      <AssistantSidebarActions expanded={expanded} />
      {expanded && <ConversationList />}
      <AssistantSidebarFooter expanded={expanded} />
    </>
  )
}

export default function AssistantSidebar() {
  const { sidebarExpanded, mobileSidebarOpen, setMobileSidebarOpen } = useAssistantStore()
  const shouldReduceMotion = useReducedMotion()

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarExpanded ? 280 : 64 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
        className="hidden h-dvh shrink-0 flex-col overflow-hidden border-r bg-muted/25 md:flex"
      >
        <SidebarBody expanded={sidebarExpanded} />
      </motion.aside>

      <Drawer open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} swipeDirection="left">
        <DrawerContent
          className="gap-0 overflow-hidden p-0"
          style={{
            '--drawer-content-height': 'calc(100dvh - 1rem)',
            '--drawer-content-width': 'min(88vw, 320px)',
          } as CSSProperties}
        >
          <DrawerHeader className="border-b text-left">
            <DrawerTitle>对话历史</DrawerTitle>
            <DrawerDescription>切换、新建或管理 AI 助手的对话</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SidebarBody expanded mobile />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
