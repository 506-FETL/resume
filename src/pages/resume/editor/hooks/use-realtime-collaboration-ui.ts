import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  RemoteUserUIState,
  UIAction,
  UIActionBroadcastPayload,
} from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useThrottledCallback } from '@/hooks/use-throttled-callback'
import {
  bindCollaborationUIChannel,
  buildCollaborationUIChannelName,
  COLLAB_UI_ACTION_EVENT,
  COLLAB_UI_STATE_EVENT,
  createRealtimeUserId,
  createUIActionPayload,
  createUIStatePayload,
  isUIChannelSubscribed,
  mergeRemoteUIState,
  removeRemoteUIUser,
  trackCollaborationUIChannelPresence,
} from '@/lib/collaboration'
import supabase from '@/lib/supabase/client'

interface UseRealtimeCollaborationUIOptions {
  roomName: string
  userName: string
  color: string
  actionBroadcastEnabled: boolean
  drawerOpen: boolean
  activeTabId: ORDERType
  onRemoteAction: (payload: UIActionBroadcastPayload) => void
  throttleMs?: number
}

interface UseRealtimeCollaborationUIResult {
  broadcastUIAction: (action: UIAction) => void
  remoteUsers: RemoteUserUIState[]
}

export function useRealtimeCollaborationUI({
  roomName,
  userName,
  color,
  actionBroadcastEnabled,
  drawerOpen,
  activeTabId,
  onRemoteAction,
  throttleMs = 100,
}: UseRealtimeCollaborationUIOptions): UseRealtimeCollaborationUIResult {
  const [connectionId] = useState(createRealtimeUserId)
  const [remoteUsersById, setRemoteUsersById] = useState<Record<number, RemoteUserUIState>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const drawerOpenRef = useRef(drawerOpen)
  const activeTabIdRef = useRef(activeTabId)
  const handleRemoteAction = useEffectEvent(onRemoteAction)

  useEffect(() => {
    drawerOpenRef.current = drawerOpen
    activeTabIdRef.current = activeTabId
  }, [drawerOpen, activeTabId])

  const broadcastState = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: COLLAB_UI_STATE_EVENT,
      payload: createUIStatePayload({
        identity: { userId: connectionId, userName, color },
        drawerOpen: drawerOpenRef.current,
        activeTabId: activeTabIdRef.current,
      }),
    })
  }, [connectionId, userName, color])

  const throttledBroadcastState = useThrottledCallback(
    broadcastState,
    throttleMs,
    [broadcastState],
  )

  useEffect(() => {
    throttledBroadcastState()
  }, [drawerOpen, activeTabId, throttledBroadcastState])

  const broadcastUIAction = useCallback((action: UIAction) => {
    if (!actionBroadcastEnabled) {
      return
    }

    channelRef.current?.send({
      type: 'broadcast',
      event: COLLAB_UI_ACTION_EVENT,
      payload: createUIActionPayload(
        { userId: connectionId, userName, color },
        action,
      ),
    })
  }, [actionBroadcastEnabled, connectionId, userName, color])

  useEffect(() => {
    const channel = bindCollaborationUIChannel({
      channel: supabase.channel(buildCollaborationUIChannelName(roomName)),
      selfUserId: connectionId,
      onRemoteUserJoin: broadcastState,
      onRemoteUserLeave: (userId) => {
        setRemoteUsersById(current => removeRemoteUIUser(current, userId))
      },
      onRemoteState: (payload) => {
        setRemoteUsersById(current => mergeRemoteUIState(current, payload))
      },
      onRemoteAction: handleRemoteAction,
    })

    channel.subscribe(async (status) => {
      if (!isUIChannelSubscribed(status)) {
        if (channelRef.current === channel) {
          channelRef.current = null
          setRemoteUsersById({})
        }
        return
      }

      channelRef.current = channel
      await trackCollaborationUIChannelPresence(channel, {
        userId: connectionId,
        userName,
        color,
      })

      if (channelRef.current === channel) {
        broadcastState()
      }
    })

    return () => {
      channel.unsubscribe()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
      setRemoteUsersById({})
    }
  }, [roomName, connectionId, userName, color, broadcastState])

  return {
    broadcastUIAction,
    remoteUsers: Object.values(remoteUsersById),
  }
}
