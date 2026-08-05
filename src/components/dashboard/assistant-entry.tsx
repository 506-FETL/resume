import { Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { rememberAssistantReturnPath, serializeInternalLocation } from '@/lib/ai/navigation'

export function AssistantEntry() {
  const location = useLocation()
  const from = serializeInternalLocation(location)

  return (
    <SidebarGroup className="pb-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip="AI 助手"
            className="border border-primary/20 bg-primary/8 font-semibold text-primary shadow-xs hover:bg-primary/12 hover:text-primary active:bg-primary/12 active:text-primary"
          >
            <Link
              to="/assistant"
              state={{ from }}
              onClick={() => rememberAssistantReturnPath(from)}
            >
              <Sparkles />
              <span>AI 助手</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
