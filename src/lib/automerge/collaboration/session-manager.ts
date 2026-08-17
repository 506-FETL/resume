import type { DocHandle, Repo } from '@automerge/automerge-repo'
import type { AutomergeResumeDocument } from '../document/schema'
import type { CollaborationCallbacks } from '../shared'
import { SupabaseNetworkAdapter } from './supabase-network-adapter'

interface CollaborationSessionManagerOptions {
  resumeId: string
  repo: Repo
  getHandle: () => DocHandle<AutomergeResumeDocument> | null
  attachHandle: (handle: DocHandle<AutomergeResumeDocument>) => void
  loadPersistedHandle: () => Promise<DocHandle<AutomergeResumeDocument> | null>
}

export class CollaborationSessionManager {
  private readonly options: CollaborationSessionManagerOptions
  private adapter: SupabaseNetworkAdapter | null = null
  private currentSessionId: string | null = null

  constructor(options: CollaborationSessionManagerOptions) {
    this.options = options
  }

  async enable(sessionId: string, callbacks: CollaborationCallbacks = {}) {
    if (this.adapter && this.currentSessionId === sessionId) {
      // 复用同会话适配器（如协作者预连接后正式 join），升级为完整回调
      this.adapter.setCallbacks(callbacks)
      return this.adapter
    }

    this.disable()

    const adapter = new SupabaseNetworkAdapter(this.options.resumeId, sessionId, callbacks)
    this.options.repo.networkSubsystem.addNetworkAdapter(adapter)

    this.adapter = adapter
    this.currentSessionId = sessionId
    this.syncHandle(this.options.getHandle())

    if (!this.options.getHandle()) {
      const handle = await this.options.loadPersistedHandle()

      if (handle) {
        this.options.attachHandle(handle)
      }
    }

    this.syncHandle(this.options.getHandle())

    return adapter
  }

  // 等待网络通道就绪（协作者在 find(docUrl) 前调用，确保有对端可同步）
  async whenChannelReady(timeoutMs?: number): Promise<void> {
    await this.adapter?.whenChannelReady(timeoutMs)
  }

  disable() {
    if (!this.adapter) {
      this.currentSessionId = null
      return
    }

    try {
      this.adapter.disconnect()
    }
    catch {
      // 忽略手动断开时的网络错误
    }

    this.options.repo.networkSubsystem.removeNetworkAdapter(this.adapter)
    this.adapter = null
    this.currentSessionId = null
  }

  syncHandle(handle: DocHandle<AutomergeResumeDocument> | null = this.options.getHandle()) {
    this.adapter?.setLocalDocumentId(handle?.documentId ?? null)
  }

  getChannelName(): string | null {
    return this.adapter?.getChannelName() ?? null
  }

  getSessionId(): string | null {
    return this.currentSessionId
  }

  broadcastControlMessage(type: string, data: Record<string, unknown> = {}) {
    this.adapter?.broadcastControlMessage(type, data)
  }
}
