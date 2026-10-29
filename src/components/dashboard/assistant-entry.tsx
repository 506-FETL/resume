import { ArrowRight, Sparkles } from 'lucide-react'
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
import { DURATION, EASE } from '@/lib/motion'

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
      className='group/assistant h-10 gap-2.5 rounded-lg border border-sidebar-border bg-background px-2.5 font-medium text-sidebar-foreground shadow-xs transition-[background-color,border-color,box-shadow] hover:border-violet-300/70 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-violet-300/70 data-[active=true]:bg-sidebar-accent dark:hover:border-violet-700/70 dark:data-[active=true]:border-violet-700/70'
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
          aria-hidden='true'
          className='flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-100/80 text-violet-600 transition-transform group-focus-visible/assistant:rotate-6 [@media(hover:hover)_and_(pointer:fine)]:group-hover/assistant:rotate-6 motion-reduce:transform-none group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:bg-transparent dark:bg-violet-400/10 dark:text-violet-300'
          style={{
            transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
            transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
        >
          <Sparkles className='size-4' />
        </span>
        <span className='group-data-[collapsible=icon]:hidden'>AI 助手</span>
        <ArrowRight
          aria-hidden='true'
          className='ml-auto size-3.5 text-muted-foreground opacity-40 transition-opacity group-focus-visible/assistant:opacity-100 group-hover/assistant:opacity-100 group-data-[collapsible=icon]:hidden'
          style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s` }}
        />
      </Link>
    </SidebarMenuButton>
  )

  return (
    <SidebarGroup className='px-3 pb-2 group-data-[collapsible=icon]:px-2'>
      <SidebarMenu>
        <SidebarMenuItem>{entry}</SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
