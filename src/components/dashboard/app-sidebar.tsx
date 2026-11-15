import type React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { AssistantEntry } from './assistant-entry'
import { Data } from './const'
import { NavOptions } from './nav-options'
import { NavUser } from './nav-user'

export function AppSidebar({
  onClick,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar
      collapsible='icon'
      {...props}
      onClick={(event) => {
        onClick?.(event)

        if (
          isMobile &&
          event.target instanceof Element &&
          event.target.closest('a[href]')
        )
          setOpenMobile(false)
      }}
    >
      <SidebarHeader className='h-16 justify-center px-3 group-data-[collapsible=icon]:px-2'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className='h-10 gap-2.5 px-2'>
              <a href='/' aria-label='GResume 展示首页'>
                <img src='/favicon.svg' alt='' className='size-5 shrink-0' />
                <span className='text-lg font-semibold tracking-tight'>
                  GResume
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='gap-1'>
        <AssistantEntry />
        <NavOptions options={Data.modules} />
      </SidebarContent>
      <SidebarFooter className='border-t border-sidebar-border/70 p-3 group-data-[collapsible=icon]:p-2'>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
