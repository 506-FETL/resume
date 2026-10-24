'use client'

import type { LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavOptions({
  description = 'Options',
  options,
}: {
  description?: string
  options: {
    title: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{description}</SidebarGroupLabel>
      <SidebarMenu>
        {options.map((item) => {
          const isActive =
            item.url === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.url)

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className='transition-colors duration-200'
              >
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
