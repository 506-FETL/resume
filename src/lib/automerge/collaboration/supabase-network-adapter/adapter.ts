import supabase from '@/lib/supabase/client'
import type { Message, PeerId, PeerMetadata } from '@automerge/automerge-repo'
import { NetworkAdapter } from '@automerge/automerge-repo'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CollaborationCallbacks, CollaborationPeer } from '../../shared'
import { PendingMessageBuffer } from './pending-messages'
import { CollaborationSendQueue } from './send-queue'
import {
  closeInbox,
  decodeSyncMessage,
  encodeSyncMessage,
  settleReadyWaiters,
  unsubscribe,
} from './transport-helpers'

export class SupabaseNetworkAdapter extends NetworkAdapter {
  private channel: RealtimeChannel | null = null
  peerId?: PeerId = undefined
  peerMetadata?: PeerMetadata = undefined
  private readonly resumeId: string
  private readonly sessionId: string
  private callbacks: CollaborationCallbacks = {}
  private channelName = ''
  private inboxId: string | null = null
  private heartbeat: ReturnType<typeof setTimeout> | null = null
  private peers = new Map<string, Record<string, unknown>>()
  private sendQueue = new CollaborationSendQueue(
    () => ({
      generation: this.connectionGeneration,
      inboxId: this.inboxId,
      ready: this.ready,
    }),
    (generation) => this.failConnection(generation),
  )
  private presenceMetadata: Record<string, unknown> = {}
  private ready = false
  private localDocumentId: string | null = null
  private pendingMessages = new PendingMessageBuffer()
  private connectionGeneration = 0
  private readyWaiters = new Set<() => void>()
  private closed = false

  constructor(
    resumeId: string,
    sessionId: string,
    callbacks: CollaborationCallbacks = {},
  ) {
    super()
    this.resumeId = resumeId
    this.sessionId = sessionId
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

  getPeers(): CollaborationPeer[] {
    return Array.from(this.peers, ([peerId, metadata]) => ({
      peerId,
      metadata: { ...metadata },
    }))
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
    if (this.connectionGeneration > 0) {
      this.disconnect()
    }

    const generation = ++this.connectionGeneration

    this.closed = false
    this.peerId = peerId
    this.peerMetadata = peerMetadata
    this.sendQueue.reset()
    this.openConnection(generation).catch(() => this.failConnection(generation))
  }

  private async openConnection(generation: number) {
    const authorization = this.callbacks.authorization

    if (!authorization) {
      throw new Error('协作租约缺失')
    }

    const { data, error } = await supabase.rpc('open_automerge_peer', {
      p_session_id: this.sessionId,
      p_resume_id: this.resumeId,
      p_peer_id: String(this.peerId),
      p_protocol_version: authorization.protocolVersion,
      p_lease_id: authorization.leaseId,
      p_metadata: { ...this.peerMetadata, ...this.presenceMetadata },
    })

    if (
      error ||
      !data?.inboxId ||
      data.topic !== `automerge:inbox:${data.inboxId}`
    ) {
      throw error || new Error('协作频道授权失败')
    }
    if (generation !== this.connectionGeneration || this.closed) {
      closeInbox(data.inboxId)

      return
    }

    this.inboxId = data.inboxId
    this.channelName = data.topic

    const channel = supabase.channel(this.channelName, {
      config: { private: true, broadcast: { self: false } },
    })

    this.channel = channel
    this.registerSyncBroadcast(channel, generation)
    this.registerControlBroadcast(channel, generation)
    this.subscribeToChannel(channel, generation)
  }

  disconnect() {
    const channel = this.channel
    const inboxId = this.inboxId
    const wasOpen = !this.closed

    ++this.connectionGeneration
    this.channel = null
    this.inboxId = null
    this.ready = false
    this.closed = true
    this.pendingMessages.clear()
    this.sendQueue.clearBatch()

    if (this.heartbeat) {
      clearTimeout(this.heartbeat)
      this.heartbeat = null
    }

    for (const peerId of this.peers.keys()) {
      this.emit('peer-disconnected', { peerId: peerId as PeerId })
    }

    this.peers.clear()

    if (channel) {
      unsubscribe(channel)
    }
    if (inboxId) {
      closeInbox(inboxId)
    }

    settleReadyWaiters(this.readyWaiters)

    if (wasOpen) {
      this.emit('close')
    }
  }

  private failConnection(generation: number) {
    if (generation !== this.connectionGeneration || this.closed) {
      return
    }

    this.disconnect()
    this.callbacks.onDisconnect?.()
  }

  send(message: Message) {
    if (!this.ready || !message.data) {
      return
    }

    this.sendQueue.send(encodeSyncMessage(message, this.localDocumentId))
  }

  getChannelName() {
    return this.channelName
  }

  async broadcastControlMessage(
    type: string,
    data: Record<string, unknown> = {},
  ) {
    if (!this.channel || !this.ready) {
      throw new Error('协作控制频道尚未就绪')
    }

    await this.sendQueue.broadcastControl(type, data)
  }

  private registerSyncBroadcast(channel: RealtimeChannel, generation: number) {
    channel.on('broadcast', { event: 'automerge-sync' }, (payload: any) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      const incoming = payload.payload || {}

      if (
        incoming.sessionId !== this.sessionId ||
        typeof incoming.senderId !== 'string' ||
        typeof incoming.userId !== 'string' ||
        typeof incoming.message !== 'string' ||
        incoming.senderId === String(this.peerId)
      ) {
        return
      }

      this.rememberPeer(incoming.senderId, {
        ...incoming.metadata,
        userId: incoming.userId,
      })

      if (incoming.targetId && incoming.targetId !== this.peerId) {
        return
      }

      if (!this.localDocumentId) {
        this.pendingMessages.enqueue(incoming)

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

  private registerControlBroadcast(
    channel: RealtimeChannel,
    generation: number,
  ) {
    channel.on('broadcast', { event: 'automerge-control' }, (payload: any) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }

      const { type, data, sessionId } = payload.payload || {}

      if (sessionId !== this.sessionId) {
        return
      }

      if (type) {
        this.callbacks.onControlMessage?.({ type, data })
      }
    })
  }

  // Presence metadata is client-controlled. Discover peers only through the RPC.
  private rememberPeer(peerId: string, metadata: Record<string, unknown>) {
    if (peerId === String(this.peerId) || this.peers.has(peerId)) {
      return
    }

    this.peers.set(peerId, metadata)

    this.emit('peer-candidate', {
      peerId: peerId as PeerId,
      peerMetadata: metadata,
    })

    this.callbacks.onPeerJoin?.({ peerId, metadata })
  }

  private async refreshPeers(channel: RealtimeChannel, generation: number) {
    const { data, error } = await supabase.rpc('refresh_automerge_peer', {
      p_inbox_id: this.inboxId,
    })

    if (!this.isCurrentConnection(channel, generation)) {
      return
    }
    if (error || !Array.isArray(data)) {
      throw error || new Error('协作租约验证失败')
    }

    const activePeers = new Set<string>()

    for (const peer of data) {
      if (
        typeof peer.peerId !== 'string' ||
        !peer.metadata ||
        typeof peer.metadata.userId !== 'string'
      ) {
        throw new Error('协作成员数据无效')
      }

      activePeers.add(peer.peerId)
      this.rememberPeer(peer.peerId, peer.metadata)
    }

    for (const peerId of this.peers.keys()) {
      if (!activePeers.has(peerId)) {
        this.peers.delete(peerId)
        this.emit('peer-disconnected', { peerId: peerId as PeerId })
        this.callbacks.onPeerLeave?.({ peerId })
      }
    }

    this.heartbeat = setTimeout(() => {
      this.refreshPeers(channel, generation).catch(() =>
        this.failConnection(generation),
      )
    }, 10_000)
  }

  private subscribeToChannel(channel: RealtimeChannel, generation: number) {
    channel.subscribe((status) => {
      if (!this.isCurrentConnection(channel, generation)) {
        return
      }
      if (status !== 'SUBSCRIBED') {
        this.failConnection(generation)

        return
      }

      this.ready = true

      this.refreshPeers(channel, generation)
        .then(() => {
          if (!this.isCurrentConnection(channel, generation)) {
            return
          }

          settleReadyWaiters(this.readyWaiters)
          this.callbacks.onChannelReady?.(this.channelName)
        })
        .catch(() => this.failConnection(generation))
    })
  }

  private isCurrentConnection(channel: RealtimeChannel, generation: number) {
    return this.channel === channel && this.connectionGeneration === generation
  }

  private flushPendingMessages() {
    if (!this.localDocumentId) {
      return
    }

    const messages = this.pendingMessages.drain()

    messages.forEach((message) => this.emitSyncMessage(message))
  }

  private emitSyncMessage(
    message: ReturnType<PendingMessageBuffer['drain']>[number],
  ) {
    try {
      const payload = decodeSyncMessage(
        message,
        this.peerId!,
        this.localDocumentId,
        this.resumeId,
      )

      this.emit('message', payload)
    } catch {
      // 忽略单条消息解析失败
    }
  }
}
