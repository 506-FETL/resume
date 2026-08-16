import type { DocHandle, Repo } from '@automerge/automerge-repo'
import type { CollaborationCallbacks, DocumentSaveResult } from '../shared'
import type { AutomergeResumeDocument, ChangeFn } from './schema'
import { CollaborationSessionManager } from '../collaboration/session-manager'
import { getAutomergeRepo } from '../repo'
import { createResumeDocument, touchDocumentMetadata } from './factory'
import { AutomergeDocumentPersistence } from './persistence'

export class DocumentManager {
  private readonly resumeId: string
  private readonly userId: string
  private readonly persistence: AutomergeDocumentPersistence
  private handle: DocHandle<AutomergeResumeDocument> | null = null
  private repo: Repo | null = null
  private collaboration: CollaborationSessionManager | null = null
  private saveListeners = new Set<(result: DocumentSaveResult) => void>()
  private saveStartListeners = new Set<() => void>()

  constructor(resumeId: string, userId: string) {
    this.resumeId = resumeId
    this.userId = userId
    this.persistence = new AutomergeDocumentPersistence(resumeId, userId)
  }

  async initialize() {
    if (this.handle) {
      return this.handle
    }

    const repo = getAutomergeRepo(this.resumeId)
    this.repo = repo
    this.collaboration ??= this.createCollaborationSession(repo)

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
    return this.handle?.url ?? null
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
