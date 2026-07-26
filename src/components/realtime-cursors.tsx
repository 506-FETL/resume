'use client'

import { memo } from 'react'
import { Cursor } from '@/components/cursor'
import { useRealtimeCursors } from '@/lib/collaboration'

const THROTTLE_MS = 12

export const RealtimeCursors = memo(({ roomName, username, color }: { roomName: string, username: string, color: string }) => {
  const { cursors } = useRealtimeCursors({ roomName, username, color, throttleMs: THROTTLE_MS })

  return (
    <div>
      {/* 远程光标 */}
      {Object.keys(cursors).map(id => (
        <Cursor
          key={id}
          className="fixed z-1000 will-change-transform top-0 left-0"
          point={cursors[id].position}
          color={cursors[id].color}
          name={cursors[id].user.name}
        />
      ))}

    </div>
  )
})
RealtimeCursors.displayName = 'RealtimeCursors'
