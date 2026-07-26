import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CursorEventPayload, UseRealtimeCursorsOptions, UseRealtimeCursorsReturn } from './types'
import { useCallback, useEffect, useRef, useState } from 'react'
import supabase from '@/lib/supabase/client'
import { createRealtimeUserId, getViewportSize, projectPointToViewport } from '../shared'
import { bindCursorChannel, broadcastCursorPayload, createCursorPayload, isCursorChannelSubscribed, trackCursorPresence } from './channel'
import { projectRealtimeCursor, removeRealtimeCursor, upsertRealtimeCursorBatch } from './state'

export function useRealtimeCursors({ roomName, username, color, throttleMs }: UseRealtimeCursorsOptions): UseRealtimeCursorsReturn {
  const [userId] = useState(createRealtimeUserId)
  const [cursors, setCursors] = useState<UseRealtimeCursorsReturn['cursors']>({})
  const cursorPayloadRef = useRef<CursorEventPayload | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const latestPointerPositionRef = useRef<CursorEventPayload['position'] | null>(null)
  const sendFrameRef = useRef<number | null>(null)
  const lastSentAtRef = useRef(0)
  const pendingRemoteCursorsRef = useRef<Record<number, CursorEventPayload>>({})
  const flushRemoteFrameRef = useRef<number | null>(null)
  const flushOutgoingCursorRef = useRef<(frameTime: number) => void>(() => {})

  const flushRemoteCursors = useCallback(() => {
    flushRemoteFrameRef.current = null

    const batch = Object.values(pendingRemoteCursorsRef.current)
    pendingRemoteCursorsRef.current = {}

    if (batch.length === 0) {
      return
    }

    setCursors(prev => upsertRealtimeCursorBatch(prev, batch))
  }, [])

  const scheduleRemoteCursorFlush = useCallback(() => {
    if (flushRemoteFrameRef.current !== null) {
      return
    }

    flushRemoteFrameRef.current = requestAnimationFrame(flushRemoteCursors)
  }, [flushRemoteCursors])

  const flushOutgoingCursor = useCallback((frameTime: number) => {
    sendFrameRef.current = null

    const latestPosition = latestPointerPositionRef.current
    if (!latestPosition) {
      return
    }

    if (frameTime - lastSentAtRef.current < throttleMs) {
      sendFrameRef.current = requestAnimationFrame((nextFrameTime) => {
        flushOutgoingCursorRef.current(nextFrameTime)
      })
      return
    }

    const payload = createCursorPayload({
      position: latestPosition,
      viewport: getViewportSize(),
      userId,
      username,
      color,
    })

    cursorPayloadRef.current = payload
    latestPointerPositionRef.current = null
    lastSentAtRef.current = frameTime
    broadcastCursorPayload(channelRef.current, payload)
  }, [throttleMs, userId, username, color])

  useEffect(() => {
    flushOutgoingCursorRef.current = flushOutgoingCursor
  }, [flushOutgoingCursor])

  const scheduleOutgoingCursorFlush = useCallback(() => {
    if (sendFrameRef.current !== null) {
      return
    }

    sendFrameRef.current = requestAnimationFrame((frameTime) => {
      flushOutgoingCursorRef.current(frameTime)
    })
  }, [])

  const handlePointerMove = useCallback((event: PointerEvent) => {
    latestPointerPositionRef.current = {
      x: event.clientX,
      y: event.clientY,
    }

    scheduleOutgoingCursorFlush()
  }, [scheduleOutgoingCursorFlush])

  useEffect(() => {
    const channel = bindCursorChannel({
      channel: supabase.channel(roomName),
      selfUserId: userId,
      onRemoteLeave: (leftUserId) => {
        delete pendingRemoteCursorsRef.current[leftUserId]
        setCursors(prev => removeRealtimeCursor(prev, leftUserId))
      },
      onRemoteCursor: (payload) => {
        pendingRemoteCursorsRef.current[payload.user.id] = projectRealtimeCursor(
          payload,
          (point, viewport) => projectPointToViewport(point, viewport),
        )
        scheduleRemoteCursorFlush()
      },
      onPeerJoin: () => {
        if (!cursorPayloadRef.current) {
          return
        }

        broadcastCursorPayload(channelRef.current, cursorPayloadRef.current)
      },
    })

    channel.subscribe(async (status) => {
      if (isCursorChannelSubscribed(status)) {
        channelRef.current = channel
        await trackCursorPresence(channel, { userId, username, color })
      }
      else {
        setCursors({})
        channelRef.current = null
      }
    })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      pendingRemoteCursorsRef.current = {}
      latestPointerPositionRef.current = null

      if (sendFrameRef.current !== null) {
        cancelAnimationFrame(sendFrameRef.current)
        sendFrameRef.current = null
      }

      if (flushRemoteFrameRef.current !== null) {
        cancelAnimationFrame(flushRemoteFrameRef.current)
        flushRemoteFrameRef.current = null
      }
    }
  }, [roomName, userId, username, color, scheduleRemoteCursorFlush])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [handlePointerMove])

  return { cursors }
}
