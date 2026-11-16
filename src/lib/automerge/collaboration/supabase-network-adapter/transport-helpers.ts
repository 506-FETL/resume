import supabase from '@/lib/supabase/client'
import type { Message, PeerId } from '@automerge/automerge-repo'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { decodeBase64ToBytes, encodeBytesToBase64 } from '../../shared'
import type { PendingMessageBuffer } from './pending-messages'

export function closeInbox(inboxId: string) {
  Promise.resolve(
    supabase.rpc('close_automerge_peer', { p_inbox_id: inboxId }),
  ).catch(() => {
    // A disconnected inbox expires server-side even if cleanup cannot reach it.
  })
}

export function unsubscribe(channel: RealtimeChannel) {
  channel.unsubscribe().catch(() => {
    // 本地状态已隔离，忽略 Supabase 解绑失败。
  })
}

export function decodeSyncMessage(
  message: ReturnType<PendingMessageBuffer['drain']>[number],
  peerId: PeerId,
  localDocumentId: string | null,
  resumeId: string,
): Message {
  const payload: Message = {
    type: message.messageType || 'message',
    senderId: message.senderId,
    targetId: message.targetId || peerId,
    data: decodeBase64ToBytes(message.message),
  }

  // An owner restore imports the same resume with a new Automerge ID while
  // guests retain the invite's ID. Server authorization binds this transport
  // to one resume/session; map its messages onto this repo's local handle.
  const resolvedDocumentId = localDocumentId || message.documentId || resumeId

  ;(payload as any).documentId = resolvedDocumentId
  ;(payload as any).channelId = resolvedDocumentId

  return payload
}

export function settleReadyWaiters(readyWaiters: Set<() => void>) {
  const waiters = [...readyWaiters]

  readyWaiters.clear()
  waiters.forEach((resolve) => resolve())
}

export function encodeSyncMessage(
  message: Message,
  localDocumentId: string | null,
) {
  return {
    targetId: message.targetId,
    messageType: message.type,
    documentId:
      ('documentId' in message && message.documentId) || localDocumentId,
    message: encodeBytesToBase64(message.data!),
  }
}
