import { usePrepareWorkingCommentWrite } from './prepare-write'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { useCallback, useEffect } from 'react'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import { isResumeCommentClientError } from '@/features/resume-comments/api/client.ts'
import { registerWorkingDocumentSync } from '@/features/resume-comments/api/working-document-sync.ts'
import {
  useResumeCommentContext,
  useResumeCommentStore,
} from '@/features/resume-comments/context.tsx'

export function useWorkingDocumentCommentSync(
  resumeId: string,
  enabled = true,
) {
  const { client, store } = useResumeCommentContext()
  const scopeId = useResumeCommentStore((state) => state.scope?.id)
  const prepareWrite = usePrepareWorkingCommentWrite(resumeId)

  const syncSnapshot = useCallback(
    async (
      snapshot: PersistedResumeSnapshot,
      currentHash: string,
      currentRevision: number,
      isCurrent: () => boolean,
    ) => {
      const projectionReferenceDate =
        store.getState().scope?.projectionReferenceDate ??
        new Date().toISOString().slice(0, 10)

      const projected = buildCommentAnchorDocument(
        snapshot,
        projectionReferenceDate,
      )

      if (projected.documentHash === currentHash) return

      try {
        const response = await client.syncWorkingDocument({
          anchorDocument: projected.document,
          documentHash: projected.documentHash,
          projectionReferenceDate,
          expectedDocumentRevision: currentRevision,
        })

        if (!isCurrent()) return

        store.getState().applyDocumentSync({
          ...response.data,
          eventSeq: response.eventSeq,
        })
      } catch (error) {
        if (!isCurrent()) return
        if (
          !isResumeCommentClientError(error) ||
          error.code !== 'stale_document'
        )
          throw error

        const latest = await client.bootstrapScope()

        if (!isCurrent()) return

        store.getState().replaceScope({
          scope: latest.data.scope,
          version: latest.data.version,
          counts: latest.data.counts,
          accessibleScopes: latest.data.accessibleScopes,
          threads: latest.data.threads,
          eventSeq: latest.eventSeq,
          lastReadEventSeq: latest.data.lastReadEventSeq,
          threadReadStates: latest.data.threadReadStates,
        })

        if (latest.data.scope.documentHash !== projected.documentHash) {
          const retry = await client.syncWorkingDocument({
            anchorDocument: projected.document,
            documentHash: projected.documentHash,
            projectionReferenceDate,
            expectedDocumentRevision: latest.data.scope.documentRevision,
          })

          if (!isCurrent()) return

          store.getState().applyDocumentSync({
            ...retry.data,
            eventSeq: retry.eventSeq,
          })
        }
      }
    },
    [client, store],
  )

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const isCurrent = () => {
      const access = client.getAccessContext()

      return (
        !cancelled &&
        access.kind === 'owner' &&
        'resumeId' in access &&
        access.resumeId === resumeId
      )
    }

    const unregister = registerWorkingDocumentSync(
      resumeId,
      async (snapshot) => {
        if (!isCurrent()) return

        let scope = store.getState().scope

        if (!scope) {
          const bootstrap = await client.bootstrapScope()

          if (!isCurrent()) return

          store.getState().replaceScope({
            scope: bootstrap.data.scope,
            version: bootstrap.data.version,
            counts: bootstrap.data.counts,
            accessibleScopes: bootstrap.data.accessibleScopes,
            threads: bootstrap.data.threads,
            eventSeq: bootstrap.eventSeq,
            lastReadEventSeq: bootstrap.data.lastReadEventSeq,
            threadReadStates: bootstrap.data.threadReadStates,
          })

          scope = bootstrap.data.scope
        }

        await syncSnapshot(
          snapshot,
          scope.documentHash,
          scope.documentRevision,
          isCurrent,
        )
      },
    )

    return () => {
      cancelled = true
      unregister()
    }
  }, [client, enabled, resumeId, store, syncSnapshot])

  useEffect(() => {
    if (!enabled || !scopeId) return

    let cancelled = false

    prepareWrite().catch((error: unknown) => {
      if (!cancelled)
        store
          .getState()
          .setContentNotice(
            error instanceof Error ? error.message : '评论文档同步失败，请重试',
          )
    })

    return () => {
      cancelled = true
    }
  }, [enabled, prepareWrite, scopeId, store])
}
