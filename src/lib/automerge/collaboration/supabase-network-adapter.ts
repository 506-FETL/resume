import type { Message, PeerId, PeerMetadata } from '@automerge/automerge-repo'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CollaborationCallbacks } from '../shared'
import { NetworkAdapter } from '@automerge/automerge-repo'
import supabase from '@/lib/supabase/client'
import {
  decodeBase64ToBytes,
  encodeBytesToBase64,
  PENDING_MESSAGE_FLUSH_LIMIT,
  PENDING_MESSAGE_LIMIT,
  PENDING_MESSAGE_TTL_MS,
} from '../shared'

interface PendingSyncMessage {
  senderId: Message['senderId']
  targetId: Message['targetId']
  messageType: Message['type']
  documentId: string | null
  message: string
  timestamp: number
}

export class SupabaseNetworkAdapter extends NetworkAdapter {
  private channel: RealtimeChannel | null = null
  peerId?: PeerId = undefined
  peerMetadata?: PeerMetadata = undefined
  private readonly resumeId: string
  private readonly sessionId: string
  private callbacks: CollaborationCallbacks = {}
  private readonly channelName: string
  private presenceMetadata: Record<string, unknown> = {}
  private ready = false
  private localDocumentId: string | null = null
  private pendingMessages: PendingSyncMessage[] = []
  private connectionGeneration = 0
  private readyWaiters = new Set<() => void>()
  private closed = false

  constructor(resumeId: string, sessionId: string, callbacks: CollaborationCallbacks = {}) {
    super()
    this.resumeId = resumeId
    this.sessionId = sessionId
    this.channelName = `automerge:resume:${resumeId}:${sessionId}`
    this.setCallbacks(callbacks)
  }

  setCallbacks(callbacks: CollaborationCallbacks) {
    this.callbacks = callbacks
    this.presenceMetadata = callbacks.presenceMetadata ?? {}
  }

  setLocalDocumentId(documentId: string | null) {
    this.localDocumentId = documentId

    if (documentId) {
      this.flushPendingMessages()
    }
  }

  isReady(): boolean {
    return this.ready
  }

  whenReady() {
    if (this.ready || this.closed) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      this.readyWaiters.add(resolve)
    })
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    const previousChannel = this.channel
    const generation = ++this.connectionGeneration

    this.closed = false
    this.ready = false
    this.pendingMessages = []
    this.peerId = peerId
    this.peerMetadata = peerMetadata
    const channel = supabase.channel(this.channelName, {
      config: {
        broadcast: { ack: true, self: false },
      },
    })
    this.channel = channel

    if (previousChannel) {
      this.unsubscribe(previousChannel)
    }

    this.registerSyncBroadcast(channel, generation)
    this.registerControlBroadcast(channel, generation)
    this.registerPresenceEvents(channel, generation)
    this.subscribeToChannel(channel, generation, peerMetadata)
  }

  disconnect() {
    const channel = this.channel
    ++this.connectionGeneration
    this.channel = null
    this.ready = false
    this.localDocumentId = null
    this.pendingMessages = []

    if (!channel) {
      return
    }

    this.closed = true
    this.unsubscribe(channel)
    this.settleReadyWaiters()
    this.emit('close')
  }

  send(message: Message) {
    if (!this.channel || !this.ready || !message.data) {
      return
    }

    this.channel.send({
      type: 'broadcast',
      event: 'automerge-sync',
      payload: {
        senderId: this.peerId,
        targetId: message.targetId,
        messageType: message.type,
        documentId: (message as any).documentId || this.localDocumentId || this.resumeId,
        message: encodeBytesToBase64(message.data),
        sessionId: this.sessionId,
      },
    })
  }

  getChannelName() {
    return this.channelName
  }

  async broadcastControlMessage(type: string, data: Record<string, unknown> = {}) {
    if (!this.channel || !this.ready) {
      throw new Error('协作控制频道尚未就绪')
    }

    const result = await this.channel.send({
      type: 'broadcast',
      event: 'automerge-control',
      payload: {
        type,
        data,
        senderId: this.peerId,
        sessionId: this.sessionId,
      },
    })

    if (result !== 'ok') {
      throw new Error(`协作控制消息发送失败: ${result}`)
    }
  }

  private registerSyncBroadcast(channel: RealtimeChannel, generation: number) {
    channel.on('broadcast', { event: 'automerge-sync' }, (payload: any) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      const incoming = payload.payload || {}

      if (incoming.targetId && incoming.targetId !== this.peerId) {
        return
      }

      if (!this.localDocumentId) {
        this.enqueuePendingMessage(incoming)
        return
      }

      this.emitSyncMessage({
        senderId: incoming.senderId,
        targetId: incoming.targetId,
        messageType: incoming.messageType,
        documentId: incoming.documentId || null,
        message: incoming.message,
        timestamp: Date.now(),
      })
    })
  }

  private registerControlBroadcast(channel: RealtimeChannel, generation: number) {
    channel.on('broadcast', { event: 'automerge-control' }, (payload: any) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      const { type, data } = payload.payload || {}

      if (type) {
        this.callbacks.onControlMessage?.({ type, data })
      }
    })
  }

  private registerPresenceEvents(channel: RealtimeChannel, generation: number) {
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      newPresences.forEach((presence: any) => {
        const remotePeerId = presence.key || presence.peerId || presence.metadata?.peerId

        if (remotePeerId && String(remotePeerId) !== String(this.peerId)) {
          this.emit('peer-candidate', {
            peerId: String(remotePeerId) as unknown as PeerId,
            peerMetadata: presence.metadata || {},
          })

          this.callbacks.onPeerJoin?.({
            peerId: String(remotePeerId),
            metadata: presence.metadata || {},
          })
        }
      })
    })

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      leftPresences.forEach((presence: any) => {
        const remotePeerId = presence.key || presence.peerId || presence.metadata?.peerId

        if (remotePeerId && String(remotePeerId) !== String(this.peerId)) {
          this.emit('peer-disconnected', {
            peerId: String(remotePeerId) as unknown as PeerId,
          })

          this.callbacks.onPeerLeave?.({ peerId: String(remotePeerId) })
        }
      })
    })
  }

  private subscribeToChannel(
    channel: RealtimeChannel,
    generation: number,
    peerMetadata?: PeerMetadata,
  ) {
    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED' || !this.isCurrentConnection(channel, generation)) {
        return
      }

      await channel.track({
        peerId: String(this.peerId),
        metadata: {
          ...(peerMetadata || {}),
          ...this.presenceMetadata,
          peerId: String(this.peerId),
        },
        online_at: new Date().toISOString(),
        sessionId: this.sessionId,
      })

      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      this.ready = true
      this.settleReadyWaiters()
      this.callbacks.onChannelReady?.(this.channelName)
    })
  }

  private isCurrentConnection(channel: RealtimeChannel, generation: number) {
    return this.channel === channel && this.connectionGeneration === generation
  }

  private settleReadyWaiters() {
    const waiters = [...this.readyWaiters]
    this.readyWaiters.clear()
    waiters.forEach(resolve => resolve())
  }

  private unsubscribe(channel: RealtimeChannel) {
    channel.unsubscribe().catch(() => {
      // 本地状态已隔离，忽略 Supabase 解绑失败。
    })
  }

  private enqueuePendingMessage(incoming: any) {
    const now = Date.now()

    this.pendingMessages = this.pendingMessages.filter(
      message => now - message.timestamp < PENDING_MESSAGE_TTL_MS,
    )

    if (this.pendingMessages.length >= PENDING_MESSAGE_LIMIT) {
      return
    }

    this.pendingMessages.push({
      senderId: incoming.senderId,
      targetId: incoming.targetId,
      messageType: incoming.messageType,
      documentId: incoming.documentId || null,
      message: incoming.message,
      timestamp: now,
    })
  }

  private flushPendingMessages() {
    if (!this.localDocumentId) {
      return
    }

    const messages = this.pendingMessages.splice(0, PENDING_MESSAGE_FLUSH_LIMIT)
    messages.forEach(message => this.emitSyncMessage(message))
  }

  private emitSyncMessage(message: PendingSyncMessage) {
    try {
      const payload: Message = {
        type: message.messageType || 'message',
        senderId: message.senderId,
        targetId: message.targetId || this.peerId!,
        data: decodeBase64ToBytes(message.message),
      }

      const resolvedDocumentId = this.localDocumentId || message.documentId || this.resumeId

      ;(payload as any).documentId = resolvedDocumentId
      ;(payload as any).channelId = resolvedDocumentId

      this.emit('message', payload)
    }
    catch {
      // 忽略单条消息解析失败
    }
  }
}
