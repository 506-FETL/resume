import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Awareness } from 'y-protocols/awareness'
import type { Doc } from 'yjs'
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import { applyUpdate, encodeStateAsUpdate } from 'yjs'
import { decodeBase64ToBytes, encodeBytesToBase64 } from '@/lib/automerge/shared'
import supabase from '@/lib/supabase/client'

/**
 * 在 Supabase Realtime broadcast 之上同步一个 `Y.Doc` 与其 `Awareness`。
 *
 * 与 Automerge 的 `SupabaseNetworkAdapter` 平行，但用独立频道
 * `yjs:resume:<resumeId>:<sessionId>`，互不干扰。
 *
 * - 文档同步：本地 `doc.update`（非本 provider 触发）→ 广播二进制 update；
 *   收远端 update → `applyUpdate(doc, bytes, this)`（origin=this 防回环）。
 * - 初始全量：新加入者广播 `sync-request`，在场者回其完整状态（`encodeStateAsUpdate`）。
 * - awareness：本地变化 → 广播 `encodeAwarenessUpdate`；收远端 → `applyAwarenessUpdate`。
 * - presence：本频道 presence；peer 离开时清其 awareness 状态。
 *
 * `CollaborationCaret` 读取 `provider.awareness`，故以公共字段暴露。
 */
export class SupabaseYjsProvider {
  readonly awareness: Awareness
  private readonly doc: Doc
  private readonly channelName: string
  private channel: RealtimeChannel | null = null
  private connected = false

  private readonly onDocUpdate: (update: Uint8Array, origin: unknown) => void
  private readonly onAwarenessUpdate: (
    changes: { added: number[], updated: number[], removed: number[] },
    origin: unknown,
  ) => void

  constructor(resumeId: string, sessionId: string, doc: Doc, awareness: Awareness) {
    this.doc = doc
    this.awareness = awareness
    this.channelName = `yjs:resume:${resumeId}:${sessionId}`

    this.onDocUpdate = (update, origin) => {
      // 本 provider 应用远端 update 时 origin===this，跳过以免回环广播
      if (origin === this) {
        return
      }
      this.broadcast('yjs-update', { update: encodeBytesToBase64(update) })
    }

    this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === 'remote') {
        return
      }
      const changed = [...added, ...updated, ...removed]
      this.broadcast('yjs-awareness', {
        update: encodeBytesToBase64(encodeAwarenessUpdate(this.awareness, changed)),
      })
    }
  }

  connect(): void {
    if (this.channel) {
      return
    }

    const channel = supabase.channel(this.channelName)
    this.channel = channel

    channel.on('broadcast', { event: 'yjs-update' }, (payload: any) => {
      const b64 = payload?.payload?.update
      if (typeof b64 === 'string') {
        applyUpdate(this.doc, decodeBase64ToBytes(b64), this)
      }
    })

    channel.on('broadcast', { event: 'yjs-awareness' }, (payload: any) => {
      const b64 = payload?.payload?.update
      if (typeof b64 === 'string') {
        applyAwarenessUpdate(this.awareness, decodeBase64ToBytes(b64), 'remote')
      }
    })

    // 新加入者请求全量；在场者以完整状态响应
    channel.on('broadcast', { event: 'yjs-sync-request' }, () => {
      this.broadcast('yjs-update', {
        update: encodeBytesToBase64(encodeStateAsUpdate(this.doc)),
      })
    })

    // presence：peer 离开时立即移除其 awareness（本端渲染的远端光标），
    // 不必等 y-protocols 30s 超时回收。用各 peer 上报的 Yjs clientID 定位。
    channel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      const leftClientIds = (leftPresences ?? [])
        .map((p: any) => p?.clientId)
        .filter((id: unknown): id is number => typeof id === 'number')
      if (leftClientIds.length > 0) {
        removeAwarenessStates(this.awareness, leftClientIds, 'remote')
      }
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        return
      }
      this.connected = true
      this.doc.on('update', this.onDocUpdate)
      this.awareness.on('update', this.onAwarenessUpdate)
      // 上报自己的 Yjs clientID，供他人在本端离开时清理 awareness
      this.channel?.track({ clientId: this.doc.clientID }).catch(() => {})
      // 请求已有对等方的全量状态
      this.broadcast('yjs-sync-request', {})
    })
  }

  /** 是否已订阅成功（host 种子化前应等待此为 true）。 */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 当前频道上的远端对等方数量（基于 Supabase presence，比尽力而为的 sync 广播可靠）。
   * 用于 host 重连时判定：无远端在场（无人持有内容）才回落种子化，避免与他人已有 Yjs 状态叠加。
   */
  getRemotePeerCount(): number {
    if (!this.channel) {
      return 0
    }
    const state = this.channel.presenceState() as Record<string, unknown[]>
    // 每个 presence key 对应一个连接；扣除自己（本端 track 一次）
    const total = Object.keys(state).length
    return Math.max(0, total - 1)
  }

  getChannelName(): string {
    return this.channelName
  }

  destroy(): void {
    // 先在解绑监听、退订频道之前广播本地离开（清除自己的 awareness），
    // 让他人即时移除本端光标，而非等 y-protocols 30s 超时回收。
    try {
      removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    }
    catch {
      // 忽略清理异常
    }

    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)

    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
    this.connected = false
  }

  private broadcast(event: string, payload: Record<string, unknown>): void {
    if (!this.channel || !this.connected) {
      return
    }
    this.channel.send({ type: 'broadcast', event, payload })
  }
}
