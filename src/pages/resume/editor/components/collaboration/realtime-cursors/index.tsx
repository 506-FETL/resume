'use client'

import type { CollaborationIdentity } from '@/lib/collaboration'
import { memo } from 'react'
import { Cursor } from '@/components/cursor'
import { useRealtimeCursors } from '@/lib/collaboration'

const THROTTLE_MS = 12

interface RealtimeCursorsProps {
  roomName: string
  identity: CollaborationIdentity
}

export const RealtimeCursors = memo(({ roomName, identity }: RealtimeCursorsProps) => {
  const { cursors } = useRealtimeCursors({
    roomName,
    username: identity.userName,
    color: identity.color,
    throttleMs: THROTTLE_MS,
  })

  return Object.values(cursors).map(cursor => (
    <Cursor
      key={cursor.user.id}
      className="fixed z-1000 will-change-transform top-0 left-0"
      point={cursor.position}
      color={cursor.color}
      name={cursor.user.name}
    />
  ))
})

RealtimeCursors.displayName = 'RealtimeCursors'
