import type { RemoteUserUIState } from '@/lib/collaboration'
import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface OnlineCollaboratorsProps {
  users: RemoteUserUIState[]
}

export function OnlineCollaborators({ users }: OnlineCollaboratorsProps) {
  if (users.length === 0) {
    return null
  }

  return (
    <Badge
      aria-label={`在线协作者 ${users.length} 人`}
      variant='secondary'
      className='gap-1 h-7 text-xs cursor-default'
    >
      <Users className='size-3' />
      {users.length}
    </Badge>
  )
}
