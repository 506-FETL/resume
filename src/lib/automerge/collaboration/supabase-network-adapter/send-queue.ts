import supabase from '@/lib/supabase/client'
import type { Message } from '@automerge/automerge-repo'

interface SyncMessagePayload {
  targetId: Message['targetId']
  messageType: Message['type']
  documentId: string | null
  message: string
}

// 与批量 RPC 的上限一致。正在发送的批次不可追加，后续消息排入下一批。
const MAX_SYNC_BATCH_SIZE = 32

interface SendConnection {
  generation: number
  inboxId: string | null
  ready: boolean
}

export class CollaborationSendQueue {
  private sendQueue: Promise<void> = Promise.resolve()
  private queuedSyncBatch: SyncMessagePayload[] | null = null
  private readonly connection: () => SendConnection
  private readonly onFailure: (generation: number) => void

  constructor(
    connection: () => SendConnection,
    onFailure: (generation: number) => void,
  ) {
    this.connection = connection
    this.onFailure = onFailure
  }

  reset() {
    this.sendQueue = Promise.resolve()
  }

  clearBatch() {
    this.queuedSyncBatch = null
  }

  send(payload: SyncMessagePayload) {
    if (
      this.queuedSyncBatch &&
      this.queuedSyncBatch.length < MAX_SYNC_BATCH_SIZE
    ) {
      this.queuedSyncBatch.push(payload)

      return
    }

    const batch = [payload]

    this.queuedSyncBatch = batch

    this.enqueueSend((inboxId) => {
      if (this.queuedSyncBatch === batch) this.queuedSyncBatch = null

      if (batch.length === 1) {
        return supabase.rpc('send_automerge_message', {
          p_inbox_id: inboxId,
          p_event: 'automerge-sync',
          p_payload: batch[0],
        })
      }

      return supabase.rpc('send_automerge_sync_batch', {
        p_inbox_id: inboxId,
        p_payloads: batch,
      })
    })
  }

  private enqueueSend(
    send: (inboxId: string) => PromiseLike<{ error: unknown }>,
  ) {
    const { generation, inboxId } = this.connection()

    const operation = this.sendQueue.then(async () => {
      if (
        generation !== this.connection().generation ||
        !this.connection().ready ||
        !inboxId
      ) {
        throw new Error('协作实时频道已断开')
      }

      const { error } = await send(inboxId)

      if (error) {
        throw error
      }
    })

    this.sendQueue = operation.catch(() => this.onFailure(generation))

    return operation
  }

  async broadcastControl(type: string, data: Record<string, unknown>) {
    // 后来的正文不能合入排在控制消息之前的批次。
    this.queuedSyncBatch = null

    await this.enqueueSend((inboxId) =>
      supabase.rpc('send_automerge_message', {
        p_inbox_id: inboxId,
        p_event: 'automerge-control',
        p_payload: { type, data },
      }),
    )
  }
}
