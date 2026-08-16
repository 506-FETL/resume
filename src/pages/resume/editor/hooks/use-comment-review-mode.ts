import type { CommentAccessContext } from '@/features/resume-comments/api/client.ts'
import type { CommentSourceOption } from '@/features/resume-comments/components/comment-source-selector.tsx'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import { isResumeCommentClientError } from '@/features/resume-comments/api/client.ts'
import {
  assertWorkingDocumentCommentsReady,
  registerWorkingDocumentSync,
} from '@/features/resume-comments/api/working-document-sync.ts'
import { useResumeCommentContext } from '@/features/resume-comments/context.tsx'
import { getResumeVersionForShare, listResumeVersions } from '@/lib/supabase/resume/history'
import useResumeStore from '@/store/resume/form'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'

export interface CommentReviewMode {
  sources: CommentSourceOption[]
  sourcesLoading: boolean
  switching: boolean
  error: string | null
  selectedKey: CommentSourceOption['key']
  access: CommentAccessContext
  snapshotOverride: PersistedResumeSnapshot | null
  manifestOverride: TemplateManifest | null
  projectionReferenceDate: string | undefined
  sourceLabel: string
  isWorking: boolean
  selectSource: (key: CommentSourceOption['key']) => Promise<boolean>
}

function historyLabel(version: Awaited<ReturnType<typeof listResumeVersions>>[number]) {
  const name = version.version_name?.trim() || version.milestone_name?.trim()
  return `V${version.version_no}${name ? ` · ${name}` : ''}`
}

export function useCommentReviewMode({
  resumeId,
  workingLabel,
  enabled,
}: {
  resumeId: string | null
  workingLabel: string
  enabled: boolean
}): CommentReviewMode {
  const [sources, setSources] = useState<CommentSourceOption[]>([{
    key: 'working',
    kind: 'working',
    label: '当前工作版本',
  }])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<CommentSourceOption['key']>('working')
  const [snapshotOverride, setSnapshotOverride] = useState<PersistedResumeSnapshot | null>(null)
  const [manifestOverride, setManifestOverride] = useState<TemplateManifest | null>(null)
  const [projectionReferenceDate, setProjectionReferenceDate] = useState<string>()

  useEffect(() => {
    setSelectedKey('working')
    setSnapshotOverride(null)
    setManifestOverride(null)
    setProjectionReferenceDate(undefined)
    setSources([{ key: 'working', kind: 'working', label: '当前工作版本' }])
    setSourcesLoading(false)
    setSwitching(false)
    setError(null)
  }, [resumeId])

  useEffect(() => {
    if (!enabled || !resumeId)
      return
    let cancelled = false
    setSourcesLoading(true)
    setError(null)
    listResumeVersions(resumeId).then((versions) => {
      if (cancelled)
        return
      const active = versions.find(version => version.status === 'active')
      const histories = versions.filter(version => version.status === 'frozen')
      setSources([
        {
          key: 'working',
          kind: 'working',
          label: '当前工作版本',
          versionId: active?.id,
        },
        ...histories.map(version => ({
          key: `history:${version.id}` as const,
          kind: 'history' as const,
          historyVersionId: version.id,
          label: historyLabel(version),
          versionNo: version.version_no,
          projectionReferenceDate: version.projection_reference_date,
        })),
      ])
    }).catch((reason) => {
      if (!cancelled)
        setError(reason instanceof Error ? reason.message : '评论来源加载失败')
    }).finally(() => {
      if (!cancelled)
        setSourcesLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, resumeId])

  const selectSource = useCallback(async (key: CommentSourceOption['key']) => {
    if (key === selectedKey)
      return true
    const source = sources.find(item => item.key === key)
    if (!source)
      return false
    setSwitching(true)
    setError(null)
    try {
      if (source.kind === 'working') {
        setSnapshotOverride(null)
        setManifestOverride(null)
        setProjectionReferenceDate(undefined)
      }
      else {
        const version = await getResumeVersionForShare(resumeId ?? '', source.historyVersionId)
        setSnapshotOverride(mapSourceToPersistedSnapshot(version.snapshot))
        setManifestOverride(null)
        setProjectionReferenceDate(source.projectionReferenceDate)
      }
      setSelectedKey(key)
      return true
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '评论来源切换失败')
      return false
    }
    finally {
      setSwitching(false)
    }
  }, [resumeId, selectedKey, sources])

  useEffect(() => {
    const leaveDeletedHistory = (historyVersionId: number) => {
      setSources(current => current.filter(source => (
        source.kind !== 'history' || source.historyVersionId !== historyVersionId
      )))
      if (selectedKey !== `history:${historyVersionId}`)
        return
      setSelectedKey('working')
      setSnapshotOverride(null)
      setManifestOverride(null)
      setProjectionReferenceDate(undefined)
      setError('正在审阅的历史版本已删除，已切回当前工作版本')
    }
    const handleWindowEvent = (event: Event) => {
      const historyVersionId = Number((event as CustomEvent).detail?.historyVersionId)
      if (Number.isInteger(historyVersionId))
        leaveDeletedHistory(historyVersionId)
    }
    window.addEventListener('resume-history-version-deleted', handleWindowEvent)
    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('resume-history-events')
      : null
    if (channel) {
      channel.onmessage = (event) => {
        const historyVersionId = Number(event.data?.historyVersionId)
        if (event.data?.type === 'history-version-deleted' && Number.isInteger(historyVersionId))
          leaveDeletedHistory(historyVersionId)
      }
    }
    return () => {
      window.removeEventListener('resume-history-version-deleted', handleWindowEvent)
      channel?.close()
    }
  }, [selectedKey])

  const selected = sources.find(source => source.key === selectedKey) ?? sources[0]!
  const access = useMemo<CommentAccessContext>(() => {
    if (selected.kind === 'history')
      return { kind: 'owner', versionId: selected.historyVersionId }
    return { kind: 'owner', resumeId: resumeId ?? '' }
  }, [resumeId, selected])

  return {
    sources,
    sourcesLoading,
    switching,
    error,
    selectedKey,
    access,
    snapshotOverride,
    manifestOverride,
    projectionReferenceDate,
    sourceLabel: selected.kind === 'working' ? workingLabel : selected.label,
    isWorking: selected.kind === 'working',
    selectSource,
  }
}

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

export function useWorkingDocumentCommentSync(resumeId: string, enabled = true) {
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
      const response = await client.syncWorkingDocument({
        anchorDocument: projected.document,
        documentHash: projected.documentHash,
        projectionReferenceDate,
        expectedDocumentRevision: currentRevision,
      })
      store.getState().applyDocumentSync({
        ...response.data,
        eventSeq: response.eventSeq,
      })
    }
    catch (error) {
      if (!isResumeCommentClientError(error) || error.code !== 'stale_document')
        throw error
      const latest = await client.bootstrapScope()
      store.getState().replaceScope({
        scope: latest.data.scope,
        version: latest.data.version,
        counts: latest.data.counts,
        accessibleScopes: latest.data.accessibleScopes,
        threads: latest.data.threads,
        eventSeq: latest.eventSeq,
        lastReadEventSeq: latest.data.lastReadEventSeq,
      })
      if (latest.data.scope.documentHash !== projected.documentHash) {
        const retry = await client.syncWorkingDocument({
          anchorDocument: projected.document,
          documentHash: projected.documentHash,
          projectionReferenceDate,
          expectedDocumentRevision: latest.data.scope.documentRevision,
        })
        store.getState().applyDocumentSync({
          ...retry.data,
          eventSeq: retry.eventSeq,
        })
      }
    }
  }, [client, store])

  useEffect(() => {
    if (!enabled)
      return
    return registerWorkingDocumentSync(resumeId, async (snapshot) => {
      let scope = store.getState().scope
      if (!scope) {
        const bootstrap = await client.bootstrapScope()
        store.getState().replaceScope({
          scope: bootstrap.data.scope,
          version: bootstrap.data.version,
          counts: bootstrap.data.counts,
          accessibleScopes: bootstrap.data.accessibleScopes,
          threads: bootstrap.data.threads,
          eventSeq: bootstrap.eventSeq,
          lastReadEventSeq: bootstrap.data.lastReadEventSeq,
        })
        scope = bootstrap.data.scope
      }
      await syncSnapshot(snapshot, scope.documentHash, scope.documentRevision)
    })
  }, [client, enabled, resumeId, store, syncSnapshot])
}
