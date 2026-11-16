import type { Message } from '@automerge/automerge-repo'
import {
  PENDING_MESSAGE_FLUSH_LIMIT,
  PENDING_MESSAGE_LIMIT,
  PENDING_MESSAGE_TTL_MS,
} from '../../shared'

interface SyncMessagePayload {
  targetId: Message['targetId']
  messageType: Message['type']
  documentId: string | null
  message: string
}

interface PendingSyncMessage extends SyncMessagePayload {
  senderId: Message['senderId']
  timestamp: number
}

export class PendingMessageBuffer {
  private messages: PendingSyncMessage[] = []

  clear() {
    this.messages = []
  }

  drain() {
    return this.messages.splice(0, PENDING_MESSAGE_FLUSH_LIMIT)
  }

  enqueue(incoming: any) {
    const now = Date.now()

    this.messages = this.messages.filter(
      (message) => now - message.timestamp < PENDING_MESSAGE_TTL_MS,
    )

    if (this.messages.length >= PENDING_MESSAGE_LIMIT) {
      return
    }

    this.messages.push({
      senderId: incoming.senderId,
      targetId: incoming.targetId,
      messageType: incoming.messageType,
      documentId: incoming.documentId || null,
      message: incoming.message,
      timestamp: now,
    })
  }
}
