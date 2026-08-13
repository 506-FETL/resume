import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  CommentRealtimeAccess,
  ResumeCommentClient,
} from './client.ts'
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
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1)
    return null
  const eventSeq = Number(payload.eventSeq)
  if (!Number.isInteger(eventSeq) || eventSeq < 0 || typeof payload.type !== 'string')
    return null
  return { schemaVersion: 1, eventSeq, type: payload.type }
}

export class ResumeCommentRealtimeSubscription {
  private readonly client: ResumeCommentClient
  private channel: RealtimeChannel | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private callbacks: CommentRealtimeCallbacks | null = null
  private generation = 0

  constructor(client: ResumeCommentClient) {
    this.client = client
  }

  connect(access: CommentRealtimeAccess, callbacks: CommentRealtimeCallbacks) {
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
      supabase.removeChannel(this.channel).catch(() => undefined)
      this.channel = null
    }
    this.callbacks = null
  }

  private subscribe(access: CommentRealtimeAccess) {
    this.generation += 1
    const generation = this.generation
    if (this.refreshTimer)
      clearTimeout(this.refreshTimer)
    if (this.channel)
      supabase.removeChannel(this.channel).catch(() => undefined)

    this.callbacks?.onStatusChange('connecting')
    const channel = supabase.channel(access.topic)
    this.channel = channel
    channel
      .on('broadcast', { event: 'invalidate' }, (message) => {
        if (generation !== this.generation)
          return
        const invalidation = readInvalidation(message.payload)
        if (!invalidation) {
          this.callbacks?.onProtocolMismatch()
          return
        }
        this.callbacks?.onInvalidation(invalidation)
      })
      .subscribe((status) => {
        if (generation !== this.generation)
          return
        if (status === 'SUBSCRIBED') {
          this.callbacks?.onStatusChange('live')
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
          this.callbacks?.onStatusChange('offline')
      })

    const refreshInMs = Math.max(
      1_000,
      Date.parse(access.expiresAt) - Date.now() - 60_000,
    )
    this.refreshTimer = setTimeout(() => {
      this.refresh(generation).catch(() => {
        if (generation === this.generation)
          this.callbacks?.onStatusChange('offline')
      })
    }, refreshInMs)
  }

  private async refresh(generation: number) {
    if (generation !== this.generation || !this.callbacks)
      return
    try {
      const response = await this.client.issueRealtimeToken()
      if (generation !== this.generation || !this.callbacks)
        return
      this.subscribe(response.data.scopeRealtime)
    }
    catch {
      if (generation === this.generation)
        this.callbacks?.onStatusChange('offline')
    }
  }
}
