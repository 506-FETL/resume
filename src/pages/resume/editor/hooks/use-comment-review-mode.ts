import type { PersistedResumeSnapshot } from '@/lib/schema'
import { useCallback, useEffect } from 'react'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import { isResumeCommentClientError } from '@/features/resume-comments/api/client.ts'
import {
  assertWorkingDocumentCommentsReady,
  registerWorkingDocumentSync,
} from '@/features/resume-comments/api/working-document-sync.ts'
import { useResumeCommentContext } from '@/features/resume-comments/context.tsx'
import useResumeStore from '@/store/resume/form'

export function usePrepareWorkingCommentWrite(resumeId: string | null) {
  return useCallback(async () => {
    if (!resumeId)
      throw new Error('离线简历不能评论')
    const before = useResumeStore.getState()
    if (before.mode !== 'online')
      throw new Error('离线简历不能评论')
    if (before.pendingChanges) {
      await before.manualSync()
      const after = useResumeStore.getState()
      if (after.pendingChanges || after.syncError)
        throw new Error(after.syncError ?? '简历尚未保存，暂时无法创建评论')
    }
    await assertWorkingDocumentCommentsReady(resumeId)
  }, [resumeId])
}

export function useWorkingDocumentCommentSync(resumeId: string) {
  const { client, store } = useResumeCommentContext()

  const syncSnapshot = useCallback(async (
    snapshot: PersistedResumeSnapshot,
    currentHash: string,
    currentRevision: number,
  ) => {
    const projectionReferenceDate = store.getState().scope?.projectionReferenceDate
      ?? new Date().toISOString().slice(0, 10)
    const projected = buildCommentAnchorDocument(snapshot, projectionReferenceDate)
    if (projected.documentHash === currentHash)
      return
    try {
      await client.syncWorkingDocument({
        anchorDocument: projected.document,
        documentHash: projected.documentHash,
        projectionReferenceDate,
        expectedDocumentRevision: currentRevision,
      })
    }
    catch (error) {
      if (!isResumeCommentClientError(error) || error.code !== 'stale_document')
        throw error
      const latest = await client.bootstrapScope()
      store.getState().replaceScope({
        scope: latest.data.scope,
        accessibleScopes: latest.data.accessibleScopes,
        threads: latest.data.threads,
        eventSeq: latest.eventSeq,
        lastReadEventSeq: latest.data.lastReadEventSeq,
      })
      if (latest.data.scope.documentHash !== projected.documentHash) {
        await client.syncWorkingDocument({
          anchorDocument: projected.document,
          documentHash: projected.documentHash,
          projectionReferenceDate,
          expectedDocumentRevision: latest.data.scope.documentRevision,
        })
      }
    }
    const refreshed = await client.bootstrapScope()
    store.getState().replaceScope({
      scope: refreshed.data.scope,
      accessibleScopes: refreshed.data.accessibleScopes,
      threads: refreshed.data.threads,
      eventSeq: refreshed.eventSeq,
      lastReadEventSeq: refreshed.data.lastReadEventSeq,
    })
  }, [client, store])

  useEffect(() => registerWorkingDocumentSync(resumeId, async (snapshot) => {
    let scope = store.getState().scope
    if (!scope) {
      const bootstrap = await client.bootstrapScope()
      store.getState().replaceScope({
        scope: bootstrap.data.scope,
        accessibleScopes: bootstrap.data.accessibleScopes,
        threads: bootstrap.data.threads,
        eventSeq: bootstrap.eventSeq,
        lastReadEventSeq: bootstrap.data.lastReadEventSeq,
      })
      scope = bootstrap.data.scope
    }
    await syncSnapshot(snapshot, scope.documentHash, scope.documentRevision)
  }), [client, resumeId, store, syncSnapshot])
}
