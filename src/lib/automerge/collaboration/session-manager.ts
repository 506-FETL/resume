import type { AnyDocumentId, AutomergeUrl, DocHandle, Repo } from '@automerge/automerge-repo'
import type { AutomergeResumeDocument } from '../document/schema'
import type { CollaborationCallbacks } from '../shared'
import { parseAutomergeUrl } from '@automerge/automerge-repo'
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

  /**
   * 协作者首次加载共享文档：先挂适配器、用 docUrl 的 documentId 预置本地文档 id（使 host 早期 sync 不被丢弃且路由正确），
   * 等到出现对端候选（host 在线）后再 repo.find(docUrl)，从而得到与 host 相同 documentId 的 handle 并原生同步。
   * 成功返回 handle；失败（host 不在线/超时/文档不可用）返回 null，由调用方回退到新建空白文档。
   */
  async prepareSharedDocument(
    sessionId: string,
    sharedDocumentUrl: string,
    peerWaitTimeoutMs: number,
    callbacks: CollaborationCallbacks = {},
  ): Promise<DocHandle<AutomergeResumeDocument> | null> {
    // 复用已有适配器或新建
    if (!this.adapter || this.currentSessionId !== sessionId) {
      this.disable()
      const adapter = new SupabaseNetworkAdapter(this.options.resumeId, sessionId, callbacks)
      this.options.repo.networkSubsystem.addNetworkAdapter(adapter)
      this.adapter = adapter
      this.currentSessionId = sessionId
    }

    let documentId: string
    try {
      documentId = parseAutomergeUrl(sharedDocumentUrl as AutomergeUrl).documentId
    }
    catch {
      return null
    }

    // 预置本地文档 id：host 的 sync 广播在 handle 建立前也能被 emit 并路由到正确的 documentId
    this.adapter.setLocalDocumentId(documentId)

    // 等 host 上线（peer-candidate），否则零 peer 时 find 会立即 unavailable
    await this.adapter.whenPeerAvailable(peerWaitTimeoutMs)
    // 让 repo 处理完 peer 注册（peer-candidate → networkSubsystem 注册 peer），再 find，
    // 避免 beginSync 时 synchronizer 尚未收录该 peer 而立即判定 unavailable
    await new Promise<void>(resolve => setTimeout(resolve, 120))

    try {
      // allowableStates 允许 requesting：有对端时文档会停留在 requesting 等待 host 同步，
      // 随后等其变为 ready；避免默认 ["ready"] 在首个同步往返未完成前误判 unavailable
      const handle = await this.options.repo.find<AutomergeResumeDocument>(
        sharedDocumentUrl as AnyDocumentId,
        { allowableStates: ['ready', 'requesting'] },
      )
      // 等待同步完成变为 ready；同时接受 unavailable 并带超时，避免 host 不响应时协作者卡在加载态
      await handle.whenReady(['ready', 'unavailable'], { signal: AbortSignal.timeout(peerWaitTimeoutMs) })
      if (handle.state !== 'ready') {
        return null
      }
      this.options.attachHandle(handle)
      this.syncHandle(handle)
      return handle
    }
    catch {
      return null
    }
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
