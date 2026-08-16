import type { DocHandle, Repo } from '@automerge/automerge-repo'
import type { DocumentSaveResult } from '../shared'
import type { AutomergeResumeDocument } from './schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { next as Automerge } from '@automerge/automerge'
import supabase from '@/lib/supabase/client'
import { RESUME_PERSISTED_SELECTOR } from '@/lib/supabase/resume/form'
import { decodeDocumentData, encodeBytesToBase64 } from '../shared'

interface AutomergeSnapshotRow {
  document_data: unknown
  metadata: Record<string, any> | null
}

export class AutomergeDocumentPersistence {
  private readonly resumeId: string
  private readonly userId: string
  private readonly sharedDocumentUrl?: string
  private canPersistToSupabase: boolean

  constructor(resumeId: string, userId: string, sharedDocumentUrl?: string) {
    this.resumeId = resumeId
    this.userId = userId
    this.sharedDocumentUrl = sharedDocumentUrl
    this.canPersistToSupabase = !sharedDocumentUrl
  }

  canPersist() {
    return this.canPersistToSupabase
  }

  getSharedDocumentUrl() {
    return this.sharedDocumentUrl
  }

  async loadHandle(repo: Repo): Promise<DocHandle<AutomergeResumeDocument> | null> {
    if (this.sharedDocumentUrl) {
      const sharedHandle = await this.loadHandleByUrl(repo, this.sharedDocumentUrl, {
        source: 'shared documentUrl',
      })

      if (sharedHandle) {
        return sharedHandle
      }
    }

    return this.loadPersistedHandle(repo)
  }

  async loadPersistedHandle(repo: Repo): Promise<DocHandle<AutomergeResumeDocument> | null> {
    const snapshot = await this.fetchSnapshotRow()

    if (!snapshot) {
      return null
    }

    if (!snapshot.document_data) {
      return null
    }

    const bytes = decodeDocumentData(snapshot.document_data)

    if (!bytes || bytes.length === 0) {
      return null
    }

    try {
      const handle = repo.import<AutomergeResumeDocument>(bytes)
      await handle.whenReady()
      return handle
    }
    catch (error) {
      console.warn('[AutomergeDocumentPersistence] import document failed:', error)
      return null
    }
  }

  async loadResumeConfig(): Promise<Partial<PersistedResumeSnapshot> | null> {
    const { data, error } = await supabase
      .from('resume_config')
      .select(RESUME_PERSISTED_SELECTOR)
      .eq('resume_id', this.resumeId)
      .eq('user_id', this.userId)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42501') {
        this.canPersistToSupabase = false
      }

      return null
    }

    if (!data) {
      this.canPersistToSupabase = false
      return null
    }

    return data as Partial<PersistedResumeSnapshot>
  }

  async saveHandle(handle: DocHandle<AutomergeResumeDocument>): Promise<DocumentSaveResult> {
    const doc = handle.doc()

    if (!doc) {
      return { success: true }
    }

    if (!this.canPersistToSupabase) {
      return { success: true }
    }

    const binary = Automerge.save(doc)
    const heads = Automerge.getHeads(doc)

    const { error } = await supabase
      .from('automerge_documents')
      .upsert(
        {
          resume_id: this.resumeId,
          user_id: this.userId,
          document_data: encodeBytesToBase64(binary),
          heads,
          document_version: doc._metadata?.version ?? 1,
          change_count: 0,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(doc._metadata ? { docMetadata: doc._metadata } : {}),
          },
        },
        {
          onConflict: 'resume_id',
        },
      )

    if (error) {
      if ((error as any)?.code === '42501' || (error as any)?.status === 403) {
        this.canPersistToSupabase = false
      }

      return {
        success: false,
        error,
      }
    }

    return { success: true }
  }

  private async fetchSnapshotRow(): Promise<AutomergeSnapshotRow | null> {
    const { data, error } = await supabase
      .from('automerge_documents')
      .select('document_data, metadata')
      .eq('resume_id', this.resumeId)
      .maybeSingle()

    if (error) {
      if (error.code === '42501') {
        this.canPersistToSupabase = false
      }

      if (error.code !== 'PGRST116') {
        console.warn('[AutomergeDocumentPersistence] fetch snapshot failed:', error)
      }

      return null
    }

    return data as AutomergeSnapshotRow | null
  }

  private async loadHandleByUrl(
    repo: Repo,
    documentUrl: string,
    options: { source: string },
  ): Promise<DocHandle<AutomergeResumeDocument> | null> {
    try {
      const handle = await repo.find<AutomergeResumeDocument>(documentUrl as any)
      await handle.whenReady()
      return handle
    }
    catch (error) {
      console.warn(`[AutomergeDocumentPersistence] load handle from ${options.source} failed:`, error)
      return null
    }
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate('[AutomergeDocumentPersistence] changed')
  })
}
