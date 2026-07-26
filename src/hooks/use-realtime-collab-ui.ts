import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SharedUIConfig, UIAction } from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bindCollaborationUIChannel,
  buildCollaborationUIChannelName,
  COLLAB_UI_ACTION_EVENT,
  COLLAB_UI_CLICK_EVENT,
  COLLAB_UI_STATE_EVENT,
  createClickPayload,
  createRealtimeUserId,
  createUIActionPayload,
  createUIStatePayload,
  isUIChannelSubscribed,
  trackCollaborationUIChannelPresence,
  useCollaborationUIStore,
} from '@/lib/collaboration'
import supabase from '@/lib/supabase/client'
import { useThrottledCallback } from './use-throttled-callback'

interface UseRealtimeCollabUIOptions {
  roomName: string
  username: string
  color: string
  uiActionBroadcastEnabled: boolean
  drawerOpen: boolean
  activeTabId: ORDERType
  config?: SharedUIConfig
  getScrollPosition?: () => number
  throttleMs?: number
}

interface UseRealtimeCollabUIReturn {
  broadcastUIAction: (action: UIAction) => void
  broadcastClick: (
    position: { x: number, y: number },
    targetLabel?: string,
  ) => void
  userId: number
}

export function useRealtimeCollabUI({
  roomName,
  username,
  color,
  uiActionBroadcastEnabled,
  drawerOpen,
  activeTabId,
  config,
  getScrollPosition,
  throttleMs = 100,
}: UseRealtimeCollabUIOptions): UseRealtimeCollabUIReturn {
  const [userId] = useState(createRealtimeUserId)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const drawerOpenRef = useRef(drawerOpen)
  const activeTabIdRef = useRef(activeTabId)
  const configRef = useRef(config)
  const getScrollPositionRef = useRef(getScrollPosition)

  const updateRemoteUIState = useCollaborationUIStore(s => s.updateRemoteUIState)
  const addRemoteClick = useCollaborationUIStore(s => s.addRemoteClick)
  const setLatestRemoteAction = useCollaborationUIStore(s => s.setLatestRemoteAction)
  const removeRemoteUser = useCollaborationUIStore(s => s.removeRemoteUser)
  const reset = useCollaborationUIStore(s => s.reset)

  useEffect(() => {
    drawerOpenRef.current = drawerOpen
    activeTabIdRef.current = activeTabId
    configRef.current = config
    getScrollPositionRef.current = getScrollPosition
  }, [drawerOpen, activeTabId, config, getScrollPosition])

  const broadcastState = useCallback(() => {
    if (!channelRef.current) {
      return
    }

    channelRef.current.send({
      type: 'broadcast',
      event: COLLAB_UI_STATE_EVENT,
      payload: createUIStatePayload({
        identity: { userId, userName: username, color },
        drawerOpen: drawerOpenRef.current,
        activeTabId: activeTabIdRef.current,
        config: configRef.current,
        getScrollPosition: getScrollPositionRef.current,
      }),
    })
  }, [userId, username, color])

  const throttledBroadcastState = useThrottledCallback(
    broadcastState,
    throttleMs,
    [broadcastState],
  )

  useEffect(() => {
    throttledBroadcastState()
  }, [drawerOpen, activeTabId, config, throttledBroadcastState])

  const broadcastUIAction = useCallback((action: UIAction) => {
    if (!uiActionBroadcastEnabled || !channelRef.current) {
      return
    }

    channelRef.current.send({
      type: 'broadcast',
      event: COLLAB_UI_ACTION_EVENT,
      payload: createUIActionPayload({ userId, userName: username, color }, action),
    })
  }, [userId, username, color, uiActionBroadcastEnabled])

  const broadcastClick = useCallback((position: { x: number, y: number }, targetLabel?: string) => {
    if (!channelRef.current) {
      return
    }

    channelRef.current.send({
      type: 'broadcast',
      event: COLLAB_UI_CLICK_EVENT,
      payload: createClickPayload({ userId, userName: username, color }, position, targetLabel),
    })
  }, [userId, username, color])

  useEffect(() => {
    const channel = bindCollaborationUIChannel({
      channel: supabase.channel(buildCollaborationUIChannelName(roomName)),
      selfUserId: userId,
      onRemoteUserLeave: removeRemoteUser,
      onRemoteState: updateRemoteUIState,
      onRemoteAction: setLatestRemoteAction,
      onRemoteClick: addRemoteClick,
    })

    channel.subscribe(async (status) => {
      if (isUIChannelSubscribed(status)) {
        channelRef.current = channel
        await trackCollaborationUIChannelPresence(channel, {
          userId,
          userName: username,
          color,
        })
        broadcastState()
      }
      else {
        channelRef.current = null
      }
    })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      reset()
    }
  }, [
    roomName,
    userId,
    username,
    color,
    addRemoteClick,
    removeRemoteUser,
    reset,
    setLatestRemoteAction,
    updateRemoteUIState,
    broadcastState,
  ])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      let targetLabel: string | undefined

      if (target) {
        const closestButton = target.closest('button')
        const closestTab = target.closest('[data-tab-id]')
        const closestSwitch = target.closest('[role="switch"]')

        if (closestTab) {
          targetLabel = closestTab.getAttribute('data-tab-id') ?? undefined
        }
        else if (closestButton) {
          targetLabel = closestButton.textContent?.trim().slice(0, 20) ?? undefined
        }
        else if (closestSwitch) {
          targetLabel = '开关'
        }
      }

      broadcastClick({ x: event.clientX, y: event.clientY }, targetLabel)
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [broadcastClick])

  return {
    broadcastUIAction,
    broadcastClick,
    userId,
  }
}
