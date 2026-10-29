'use client'

import type { LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavOptions({
  description,
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
  const reduceMotion = useReducedMotion()

  return (
    <SidebarGroup className='px-3 group-data-[collapsible=icon]:px-2'>
      {description && <SidebarGroupLabel>{description}</SidebarGroupLabel>}
      <SidebarMenu className='gap-1'>
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
                tooltip={item.title}
                className='h-9 gap-3 px-3 text-sidebar-foreground/80 transition-colors data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground'
                style={{
                  transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
                }}
              >
                <Link
                  to={item.url}
                  aria-current={isActive ? 'page' : undefined}
                >
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
