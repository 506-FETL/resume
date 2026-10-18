import type React from 'react'
import { FileText } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { DURATION, EASE } from '@/lib/motion'
import useUserStore from '@/store/user'
import { AssistantEntry } from './assistant-entry'
import { Data } from './const'
import { NavOptions } from './nav-options'
import { NavUser } from './nav-user'

const ConversationNavigation = lazy(() => import('@/pages/assistant/components/conversation-navigation'))

export function AppSidebar({ onClick, ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()
  const authStatus = useUserStore(state => state.authStatus)
  const isAssistantRoute = pathname === '/assistant' || pathname.startsWith('/assistant/')

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      onClick={(event) => {
        onClick?.(event)

        if (isMobile && event.target instanceof Element && event.target.closest('a[href]'))
          setOpenMobile(false)
      }}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5">
              <Link to="/">
                <FileText className="size-5" />
                <span className="text-base font-semibold">Resume</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AssistantEntry />
        <NavOptions options={Data.modules} description="模块" />
        <AnimatePresence initial={false}>
          {isAssistantRoute && authStatus === 'authenticated' && (
            <motion.div
              key="assistant-conversations"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 8, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
              transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
              className="flex min-h-48 flex-1 flex-col border-t border-sidebar-border group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:flex-none"
            >
              <Suspense fallback={null}>
                <ConversationNavigation />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
