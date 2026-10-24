import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CommentRealtimeAccess, ResumeCommentClient } from './client.ts'
import supabase from '@/lib/supabase/client'

export interface CommentRealtimeInvalidation {
  schemaVersion: 1
  eventSeq: number
  type: string
}

export interface CommentRealtimeCallbacks {
  onInvalidation: (event: CommentRealtimeInvalidation) => void
  onProtocolMismatch: () => void
  onStatusChange: (status: 'connecting' | 'live' | 'offline') => void
}

function readInvalidation(value: unknown): CommentRealtimeInvalidation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1)
    return null
  const eventSeq = Number(payload.eventSeq)
  if (
    !Number.isInteger(eventSeq) ||
    eventSeq < 0 ||
    typeof payload.type !== 'string'
  )
    return null
  return { schemaVersion: 1, eventSeq, type: payload.type }
}

export class ResumeCommentRealtimeSubscription {
  private readonly client: ResumeCommentClient
  private readonly accessKind: 'owner' | 'scope'
  private channel: RealtimeChannel | null = null
  private topic: string | null = null
  private channelStatus: 'connecting' | 'live' | 'offline' = 'offline'
  private retryAttempts = 0
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private callbacks: CommentRealtimeCallbacks | null = null
  private generation = 0

  constructor(
    client: ResumeCommentClient,
    accessKind: 'owner' | 'scope' = 'scope',
  ) {
    this.client = client
    this.accessKind = accessKind
  }

  connect(access: CommentRealtimeAccess, callbacks: CommentRealtimeCallbacks) {
    this.generation += 1
    this.retryAttempts = 0
    this.callbacks = callbacks
    this.subscribe(access)
  }

  disconnect() {
    this.generation += 1
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    if (this.channel) {
      const channel = this.channel
      this.channel = null
      supabase.removeChannel(channel).catch(() => undefined)
    }
    this.topic = null
    this.retryAttempts = 0
    this.callbacks = null
  }

  private subscribe(access: CommentRealtimeAccess) {
    if (this.channel && this.topic === access.topic) {
      this.callbacks?.onStatusChange(this.channelStatus)
      this.scheduleRefresh(access)
      return
    }
    if (this.channel) {
      const channel = this.channel
      this.channel = null
      supabase.removeChannel(channel).catch(() => undefined)
    }

    this.channelStatus = 'connecting'
    this.callbacks?.onStatusChange('connecting')
    const channel = supabase.channel(access.topic)
    this.channel = channel
    this.topic = access.topic
    channel
      .on('broadcast', { event: 'invalidate' }, (message) => {
        if (channel !== this.channel) return
        const invalidation = readInvalidation(message.payload)
        if (!invalidation) {
          this.callbacks?.onProtocolMismatch()
          return
        }
        this.callbacks?.onInvalidation(invalidation)
      })
      .subscribe((status) => {
        if (channel !== this.channel) return
        if (status === 'SUBSCRIBED') {
          this.channelStatus = 'live'
          this.callbacks?.onStatusChange('live')
          return
        }
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          this.channelStatus = 'offline'
          this.callbacks?.onStatusChange('offline')
        }
      })

    this.scheduleRefresh(access)
  }

  private scheduleRefresh(access?: CommentRealtimeAccess) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    const remainingMs = access ? Date.parse(access.expiresAt) - Date.now() : 0
    // Topic 只在桶边界变化；过期的同 topic 响应也走退避，避免时钟偏差造成轮询风暴。
    const refreshInMs =
      remainingMs > 0
        ? remainingMs
        : Math.min(1_000 * 2 ** Math.min(this.retryAttempts++, 5), 30_000)
    if (remainingMs > 0) this.retryAttempts = 0
    const generation = this.generation
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      // refresh 自行处理失败，并为当前连接安排下一次有界退避。
      this.refresh(generation).catch(() => undefined)
    }, refreshInMs)
  }

  private async refresh(generation: number) {
    if (generation !== this.generation || !this.callbacks) return
    try {
      const response = await this.client.issueRealtimeToken()
      if (generation !== this.generation || !this.callbacks) return
      const access =
        this.accessKind === 'owner'
          ? response.data.ownerRealtime
          : response.data.scopeRealtime
      if (!access) throw new Error('Realtime access is unavailable')
      this.subscribe(access)
    } catch {
      if (generation === this.generation && this.callbacks) {
        this.callbacks?.onStatusChange('offline')
        this.scheduleRefresh()
      }
    }
  }
}
