import type { RemoteUserUIState } from '@/lib/collaboration'
import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface OnlineCollaboratorsProps {
  users: RemoteUserUIState[]
}

export function OnlineCollaborators({ users }: OnlineCollaboratorsProps) {
  if (users.length === 0) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="gap-1 h-7 text-xs cursor-default">
          <Users className="size-3" />
          {users.length}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p className="font-medium mb-1">在线协作者</p>
          {users.map(user => (
            <div key={user.userId} className="flex items-center gap-2 py-0.5">
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: user.color }}
              />
              <span>{user.userName}</span>
              <span className="text-muted-foreground">
                {user.drawerOpen ? '编辑中' : '预览中'}
                {user.activeTabId ? ` · ${user.activeTabId}` : ''}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
