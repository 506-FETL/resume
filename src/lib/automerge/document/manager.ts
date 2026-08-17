import type { DocHandle, Repo } from '@automerge/automerge-repo'
import type { CollaborationCallbacks, DocumentSaveResult } from '../shared'
import type { AutomergeResumeDocument, ChangeFn } from './schema'
import { CollaborationSessionManager } from '../collaboration/session-manager'
import { getAutomergeRepo } from '../repo'
import { SHARED_DOCUMENT_ADAPTER_READY_TIMEOUT_MS } from '../shared'
import { createResumeDocument, touchDocumentMetadata } from './factory'
import { AutomergeDocumentPersistence } from './persistence'

interface SharedCollaborationInit {
  sessionId: string
  presenceMetadata?: Record<string, unknown>
}

interface DocumentManagerOptions {
  sharedDocumentUrl?: string
  // 协作者通过共享 docUrl 加载时，先用该会话信息挂载网络适配器再 find，避免零 peer 回退空白文档
  sharedCollaboration?: SharedCollaborationInit
}

export class DocumentManager {
  private readonly resumeId: string
  private readonly userId: string
  private readonly persistence: AutomergeDocumentPersistence
  private readonly sharedCollaboration?: SharedCollaborationInit
  private handle: DocHandle<AutomergeResumeDocument> | null = null
  private repo: Repo | null = null
  private collaboration: CollaborationSessionManager | null = null
  private saveListeners = new Set<(result: DocumentSaveResult) => void>()
  private saveStartListeners = new Set<() => void>()

  constructor(resumeId: string, userId: string, options: DocumentManagerOptions = {}) {
    this.resumeId = resumeId
    this.userId = userId
    this.sharedCollaboration = options.sharedCollaboration
    this.persistence = new AutomergeDocumentPersistence(resumeId, userId, options.sharedDocumentUrl)
  }

  async initialize() {
    if (this.handle) {
      return this.handle
    }

    const repo = getAutomergeRepo(this.resumeId)
    this.repo = repo
    this.collaboration ??= this.createCollaborationSession(repo)

    // 协作者场景：先挂载网络适配器并等通道就绪，使随后的 repo.find(docUrl) 有对端可同步，
    // 避免零 peer 时被立即判定 unavailable 而回退到新建空白文档（导致协作者简历为空）。
    if (this.persistence.getSharedDocumentUrl() && this.sharedCollaboration) {
      await this.collaboration.enable(this.sharedCollaboration.sessionId, {
        presenceMetadata: this.sharedCollaboration.presenceMetadata,
      })
      await this.collaboration.whenChannelReady(SHARED_DOCUMENT_ADAPTER_READY_TIMEOUT_MS)
    }

    const existingHandle = await this.persistence.loadHandle(repo)

    if (existingHandle) {
      return this.attachHandle(existingHandle)
    }

    const seedData = await this.persistence.loadResumeConfig()
    const handle = await createResumeDocument({
      repo,
      resumeId: this.resumeId,
      userId: this.userId,
      seedData,
    })

    this.attachHandle(handle)

    if (this.persistence.canPersist()) {
      try {
        await this.saveToSupabase(handle)
      }
      catch (error) {
        console.warn('[DocumentManager] initial save failed:', error)
      }
    }

    return handle
  }

  async saveToSupabase(handle: DocHandle<AutomergeResumeDocument> | null = this.handle) {
    if (!handle) {
      return
    }

    if (this.persistence.canPersist()) {
      this.notifySaveStart()
    }

    const result = await this.persistence.saveHandle(handle)
    this.notifySaveListeners(result)

    if (!result.success) {
      throw normalizeSaveError(result.error)
    }
  }

  async enableCollaboration(sessionId: string, callbacks: CollaborationCallbacks = {}) {
    if (!this.repo) {
      throw new Error('Automerge repo 尚未初始化')
    }

    this.collaboration ??= this.createCollaborationSession(this.repo)
    return this.collaboration.enable(sessionId, callbacks)
  }

  disableCollaboration() {
    this.collaboration?.disable()
  }

  getCollaborationChannelName(): string | null {
    return this.collaboration?.getChannelName() ?? null
  }

  getCollaborationSessionId(): string | null {
    return this.collaboration?.getSessionId() ?? null
  }

  broadcastCollaborationEvent(type: string, data: Record<string, unknown> = {}) {
    this.collaboration?.broadcastControlMessage(type, data)
  }

  onSaveResult(listener: (result: DocumentSaveResult) => void): () => void {
    this.saveListeners.add(listener)

    return () => {
      this.saveListeners.delete(listener)
    }
  }

  onSaveStart(listener: () => void): () => void {
    this.saveStartListeners.add(listener)

    return () => {
      this.saveStartListeners.delete(listener)
    }
  }

  getHandle(): DocHandle<AutomergeResumeDocument> | null {
    return this.handle
  }

  getDocumentUrl(): string | null {
    return this.handle?.url ?? this.persistence.getSharedDocumentUrl() ?? null
  }

  getDocumentId(): string | null {
    return this.handle?.documentId ?? null
  }

  getDoc(): AutomergeResumeDocument | null {
    return this.handle?.doc() ?? null
  }

  change(changeFn: ChangeFn<AutomergeResumeDocument>) {
    if (!this.handle) {
      return
    }

    this.handle.change((doc) => {
      changeFn(doc)
      touchDocumentMetadata(doc, {
        resumeId: this.resumeId,
        userId: this.userId,
      })
    })
  }

  destroy() {
    this.saveListeners.clear()
    this.saveStartListeners.clear()
    this.collaboration?.disable()
    this.collaboration = null
    this.repo = null
    this.handle = null
  }

  private createCollaborationSession(repo: Repo) {
    return new CollaborationSessionManager({
      resumeId: this.resumeId,
      repo,
      getHandle: () => this.handle,
      attachHandle: handle => this.attachHandle(handle),
      loadPersistedHandle: () => this.persistence.loadPersistedHandle(repo),
    })
  }

  private attachHandle(handle: DocHandle<AutomergeResumeDocument>) {
    this.handle = handle
    this.collaboration?.syncHandle(handle)
    return handle
  }

  private notifySaveListeners(result: DocumentSaveResult) {
    this.saveListeners.forEach((listener) => {
      try {
        listener(result)
      }
      catch (error) {
        console.warn('[DocumentManager] save listener threw:', error)
      }
    })
  }

  private notifySaveStart() {
    this.saveStartListeners.forEach((listener) => {
      try {
        listener()
      }
      catch (error) {
        console.warn('[DocumentManager] save start listener threw:', error)
      }
    })
  }
}

function normalizeSaveError(error: unknown) {
  return error instanceof Error ? error : new Error('Automerge 文档保存失败')
}
