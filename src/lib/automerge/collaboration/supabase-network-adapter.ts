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
  private readonly callbacks: CollaborationCallbacks
  private readonly channelName: string
  private readonly presenceMetadata: Record<string, any>
  private ready = false
  private localDocumentId: string | null = null
  private pendingMessages: PendingSyncMessage[] = []

  constructor(resumeId: string, sessionId: string, callbacks: CollaborationCallbacks = {}) {
    super()
    this.resumeId = resumeId
    this.sessionId = sessionId
    this.callbacks = callbacks
    this.channelName = `automerge:resume:${resumeId}:${sessionId}`
    this.presenceMetadata = callbacks.presenceMetadata || {}
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
    if (this.ready) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      let handlePeerCandidate = () => {}

      const handleClose = () => {
        this.off('peer-candidate', handlePeerCandidate)
        resolve()
      }

      handlePeerCandidate = () => {
        this.off('close', handleClose)
        resolve()
      }

      this.once('peer-candidate', handlePeerCandidate)
      this.once('close', handleClose)
    })
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    this.peerId = peerId
    this.peerMetadata = peerMetadata
    this.channel = supabase.channel(this.channelName)

    this.registerSyncBroadcast()
    this.registerControlBroadcast()
    this.registerPresenceEvents()
    this.subscribeToChannel(peerMetadata)
  }

  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }

    this.ready = false
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

  broadcastControlMessage(type: string, data: Record<string, any> = {}) {
    if (!this.channel) {
      return
    }

    this.channel.send({
      type: 'broadcast',
      event: 'automerge-control',
      payload: {
        type,
        data,
        senderId: this.peerId,
        sessionId: this.sessionId,
      },
    })
  }

  private registerSyncBroadcast() {
    this.channel?.on('broadcast', { event: 'automerge-sync' }, (payload: any) => {
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

  private registerControlBroadcast() {
    this.channel?.on('broadcast', { event: 'automerge-control' }, (payload: any) => {
      const { type, data } = payload.payload || {}

      if (type) {
        this.callbacks.onControlMessage?.({ type, data })
      }
    })
  }

  private registerPresenceEvents() {
    this.channel?.on('presence', { event: 'join' }, ({ newPresences }) => {
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

    this.channel?.on('presence', { event: 'leave' }, ({ leftPresences }) => {
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

  private subscribeToChannel(peerMetadata?: PeerMetadata) {
    this.channel?.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') {
        return
      }

      await this.channel?.track({
        peerId: String(this.peerId),
        metadata: {
          ...(peerMetadata || {}),
          ...this.presenceMetadata,
          peerId: String(this.peerId),
        },
        online_at: new Date().toISOString(),
        sessionId: this.sessionId,
      })

      this.ready = true
      this.callbacks.onChannelReady?.(this.channelName)
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
