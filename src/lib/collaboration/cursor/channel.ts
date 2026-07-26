import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CursorEventPayload } from './types'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { getPresenceUserId } from '../shared'
import { COLLAB_CURSOR_EVENT } from './constants'

export function createCursorPayload(options: {
  position: CursorEventPayload['position']
  viewport?: CursorEventPayload['viewport']
  userId: number
  username: string
  color: string
}): CursorEventPayload {
  const { position, viewport, userId, username, color } = options

  return {
    position,
    viewport,
    user: {
      id: userId,
      name: username,
    },
    color,
    timestamp: Date.now(),
  }
}

export function broadcastCursorPayload(channel: RealtimeChannel | null, payload: CursorEventPayload) {
  channel?.send({
    type: 'broadcast',
    event: COLLAB_CURSOR_EVENT,
    payload,
  })
}

export function bindCursorChannel(options: {
  channel: RealtimeChannel
  selfUserId: number
  onRemoteLeave: (userId: number) => void
  onRemoteCursor: (payload: CursorEventPayload) => void
  onPeerJoin: () => void
}) {
  const {
    channel,
    selfUserId,
    onRemoteLeave,
    onRemoteCursor,
    onPeerJoin,
  } = options

  channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    leftPresences.forEach((presence) => {
      const parsedUserId = getPresenceUserId(presence)

      if (parsedUserId === null || parsedUserId === selfUserId) {
        return
      }

      onRemoteLeave(parsedUserId)
    })
  })

  channel.on('presence', { event: 'join' }, () => {
    onPeerJoin()
  })

  channel.on(
    'broadcast',
    { event: COLLAB_CURSOR_EVENT },
    (data: { payload: CursorEventPayload }) => {
      if (data.payload.user.id === selfUserId) {
        return
      }

      onRemoteCursor(data.payload)
    },
  )

  return channel
}

export async function trackCursorPresence(
  channel: RealtimeChannel,
  options: { userId: number, username: string, color: string },
) {
  const { userId, username, color } = options

  await channel.track({
    userId,
    metadata: {
      userId,
      userName: username,
      color,
    },
    onlineAt: new Date().toISOString(),
  })
}

export function isCursorChannelSubscribed(status: string) {
  return status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED
}
