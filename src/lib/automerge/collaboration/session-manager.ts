import type { DocHandle, Repo } from '@automerge/automerge-repo'
import type { AutomergeResumeDocument } from '../document/schema'
import type { CollaborationCallbacks } from '../shared'
import { SupabaseNetworkAdapter } from './supabase-network-adapter'

interface CollaborationSessionManagerOptions {
  resumeId: string
  repo: Repo
  getHandle: () => DocHandle<AutomergeResumeDocument> | null
}

export interface CollaborationSessionActivation {
  adapter: SupabaseNetworkAdapter
  activationId: number
}

export class CollaborationSessionManager {
  private readonly options: CollaborationSessionManagerOptions
  private adapter: SupabaseNetworkAdapter | null = null
  private currentSessionId: string | null = null
  private activationSequence = 0
  private currentActivationId: number | null = null

  constructor(options: CollaborationSessionManagerOptions) {
    this.options = options
  }

  async enable(
    sessionId: string,
    callbacks: CollaborationCallbacks = {},
  ): Promise<CollaborationSessionActivation> {
    const handle = this.options.getHandle()
    if (!handle) {
      throw new Error('Automerge 文档尚未初始化')
    }
    const activationId = ++this.activationSequence

    if (this.adapter && this.currentSessionId === sessionId) {
      this.adapter.setCallbacks(callbacks)
      this.currentActivationId = activationId
      this.syncHandle(handle)
      return { adapter: this.adapter, activationId }
    }

    this.disable()

    const adapter = new SupabaseNetworkAdapter(this.options.resumeId, sessionId, callbacks)
    this.options.repo.networkSubsystem.addNetworkAdapter(adapter)

    this.adapter = adapter
    this.currentSessionId = sessionId
    this.currentActivationId = activationId
    this.syncHandle(handle)

    return { adapter, activationId }
  }

  disable(expectedActivationId?: number) {
    if (
      expectedActivationId !== undefined
      && expectedActivationId !== this.currentActivationId
    ) {
      return false
    }

    if (!this.adapter) {
      this.currentSessionId = null
      this.currentActivationId = null
      return true
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
    this.currentActivationId = null
    return true
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
    if (!this.adapter) {
      throw new Error('协作连接尚未建立')
    }

    return this.adapter.broadcastControlMessage(type, data)
  }
}
