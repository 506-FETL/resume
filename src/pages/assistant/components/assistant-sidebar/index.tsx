import { motion, useReducedMotion } from 'motion/react'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
      {expanded && (
        <>
          <Separator className="mx-3 w-auto" />
          <div className="min-h-0 flex-1 px-3 pt-3 pb-3">
            <ConversationList />
          </div>
        </>
      )}
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

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[min(88vw,320px)] gap-0 p-0">
          <SheetHeader className="border-b pr-12 text-left">
            <SheetTitle>对话历史</SheetTitle>
            <SheetDescription>切换、新建或管理 AI 助手的对话</SheetDescription>
          </SheetHeader>
          <SidebarBody expanded mobile />
        </SheetContent>
      </Sheet>
    </>
  )
}
