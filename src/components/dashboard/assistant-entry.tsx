import { Sparkles } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Link, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  rememberAssistantReturnPath,
  serializeInternalLocation,
} from '@/lib/ai/navigation'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function AssistantEntry() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const from = serializeInternalLocation(location)

  const isActive =
    location.pathname === '/assistant' ||
    location.pathname.startsWith('/assistant/')

  const entry = (
    <SidebarMenuButton
      asChild
      tooltip='AI 助手'
      isActive={isActive}
      className={cn(
        'transition-colors',
        isActive &&
          'data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground',
      )}
      style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
    >
      <Link
        to='/assistant'
        aria-label='AI 助手'
        state={{ from }}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => rememberAssistantReturnPath(from)}
      >
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-md transition-colors group-data-[collapsible=icon]:size-4',
            isActive
              ? 'bg-primary-foreground/15'
              : 'bg-violet-500/15 text-violet-600 ring-1 ring-inset ring-violet-500/20 dark:text-violet-400',
          )}
          style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
        >
          <Sparkles className='size-3.5' />
        </span>
        <span className='group-data-[collapsible=icon]:hidden'>AI 助手</span>
      </Link>
    </SidebarMenuButton>
  )

  return (
    <SidebarGroup className='pb-1'>
      <SidebarMenu>
        <SidebarMenuItem>{entry}</SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
