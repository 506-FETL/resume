import type React from 'react'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { AssistantEntry } from './assistant-entry'
import { Data } from './const'
import { NavOptions } from './nav-options'
import { NavUser } from './nav-user'

export function AppSidebar({ onClick, ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar()

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
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
