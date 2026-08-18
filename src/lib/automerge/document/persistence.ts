import type { AutomergeUrl, DocHandle, Repo } from '@automerge/automerge-repo'
import type { DocumentInitializationSource, DocumentSaveResult } from '../shared'
import type { AutomergeResumeDocument } from './schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { next as Automerge } from '@automerge/automerge'
import { parseAutomergeUrl } from '@automerge/automerge-repo'
import supabase from '@/lib/supabase/client'
import { RESUME_PERSISTED_SELECTOR } from '@/lib/supabase/resume/form'
import {
  CollaborationDocumentLoadError,
  decodeDocumentData,
  encodeBytesToBase64,
} from '../shared'

interface AutomergeSnapshotRow {
  document_data: unknown
  metadata: Record<string, any> | null
}

export class AutomergeDocumentPersistence {
  private readonly resumeId: string
  private readonly userId: string
  private readonly canPersistToSupabase: boolean

  constructor(resumeId: string, userId: string, source: DocumentInitializationSource) {
    this.resumeId = resumeId
    this.userId = userId
    this.canPersistToSupabase = source.kind === 'owner'
  }

  canPersist() {
    return this.canPersistToSupabase
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

  async importCollaborationHandle(
    repo: Repo,
    documentUrl: string,
    documentData: string,
  ): Promise<DocHandle<AutomergeResumeDocument>> {
    try {
      const { documentId } = parseAutomergeUrl(documentUrl as AutomergeUrl)
      const bytes = decodeDocumentData(documentData)
      if (!bytes?.length) {
        throw new Error('共享快照为空')
      }

      const handle = repo.import<AutomergeResumeDocument>(bytes, { docId: documentId })
      await handle.whenReady()
      const doc = handle.doc()
      if (!doc || doc._metadata?.resumeId !== this.resumeId) {
        throw new Error('共享快照与简历身份不匹配')
      }
      return handle
    }
    catch (error) {
      throw new CollaborationDocumentLoadError('共享简历文档无效', { cause: error })
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
      return null
    }

    if (!data) {
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
      if (error.code !== 'PGRST116') {
        console.warn('[AutomergeDocumentPersistence] fetch snapshot failed:', error)
      }

      return null
    }

    return data as AutomergeSnapshotRow | null
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate('[AutomergeDocumentPersistence] changed')
  })
}
