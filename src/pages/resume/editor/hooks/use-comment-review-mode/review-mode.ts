import type { CommentAccessContext } from '@/features/resume-comments/api/client.ts'
import type { CommentSourceOption } from '@/features/resume-comments/components/comment-source-selector.tsx'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getResumeVersionForShare,
  listResumeVersions,
} from '@/lib/supabase/resume/history/queries'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'

export interface CommentReviewMode {
  sources: CommentSourceOption[]
  sourcesLoading: boolean
  switching: boolean
  error: string | null
  selectedKey: CommentSourceOption['key']
  access: CommentAccessContext
  snapshotOverride: PersistedResumeSnapshot | null
  definitionOverride: TemplateDefinition | null
  projectionReferenceDate: string | undefined
  sourceLabel: string
  isWorking: boolean
  selectSource: (key: CommentSourceOption['key']) => Promise<boolean>
}

function historyLabel(
  version: Awaited<ReturnType<typeof listResumeVersions>>[number],
) {
  const name = version.version_name?.trim() || version.milestone_name?.trim()

  return `V${version.version_no}${name ? ` · ${name}` : ''}`
}

export function useCommentReviewMode({
  resumeId,
  workingLabel,
  enabled,
  collaboratorMode = false,
  collaboratorAccess = null,
}: {
  resumeId: string | null
  workingLabel: string
  enabled: boolean
  collaboratorMode?: boolean
  collaboratorAccess?: Extract<
    CommentAccessContext,
    { kind: 'collaborator' }
  > | null
}): CommentReviewMode {
  const [sources, setSources] = useState<CommentSourceOption[]>([
    {
      key: 'working',
      kind: 'working',
      label: '当前工作版本',
    },
  ])

  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedKey, setSelectedKey] =
    useState<CommentSourceOption['key']>('working')

  const [snapshotOverride, setSnapshotOverride] =
    useState<PersistedResumeSnapshot | null>(null)

  const [definitionOverride, setDefinitionOverride] =
    useState<TemplateDefinition | null>(null)

  const [projectionReferenceDate, setProjectionReferenceDate] =
    useState<string>()

  useEffect(() => {
    setSelectedKey('working')
    setSnapshotOverride(null)
    setDefinitionOverride(null)
    setProjectionReferenceDate(undefined)
    setSources([{ key: 'working', kind: 'working', label: '当前工作版本' }])
    setSourcesLoading(false)
    setSwitching(false)
    setError(null)
  }, [collaboratorMode, resumeId])

  useEffect(() => {
    if (!enabled || !resumeId || collaboratorMode) return

    let cancelled = false

    setSourcesLoading(true)
    setError(null)

    listResumeVersions(resumeId)
      .then((versions) => {
        if (cancelled) return

        const active = versions.find((version) => version.status === 'active')

        const histories = versions.filter(
          (version) => version.status === 'frozen',
        )

        setSources([
          {
            key: 'working',
            kind: 'working',
            label: '当前工作版本',
            versionId: active?.id,
          },
          ...histories.map((version) => ({
            key: `history:${version.id}` as const,
            kind: 'history' as const,
            historyVersionId: version.id,
            label: historyLabel(version),
            versionNo: version.version_no,
            projectionReferenceDate: version.projection_reference_date,
          })),
        ])
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : '评论来源加载失败',
          )
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [collaboratorMode, enabled, resumeId])

  const selectSource = useCallback(
    async (key: CommentSourceOption['key']) => {
      if (key === selectedKey) return true
      if (collaboratorMode && key !== 'working') return false

      const source = sources.find((item) => item.key === key)

      if (!source) return false

      setSwitching(true)
      setError(null)

      try {
        if (source.kind === 'working') {
          setSnapshotOverride(null)
          setDefinitionOverride(null)
          setProjectionReferenceDate(undefined)
        } else {
          const version = await getResumeVersionForShare(
            resumeId ?? '',
            source.historyVersionId,
          )

          setSnapshotOverride(mapSourceToPersistedSnapshot(version.snapshot))
          setDefinitionOverride(null)
          setProjectionReferenceDate(source.projectionReferenceDate)
        }

        setSelectedKey(key)

        return true
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '评论来源切换失败')

        return false
      } finally {
        setSwitching(false)
      }
    },
    [collaboratorMode, resumeId, selectedKey, sources],
  )

  useEffect(() => {
    const leaveDeletedHistory = (historyVersionId: number) => {
      setSources((current) =>
        current.filter(
          (source) =>
            source.kind !== 'history' ||
            source.historyVersionId !== historyVersionId,
        ),
      )

      if (selectedKey !== `history:${historyVersionId}`) return

      setSelectedKey('working')
      setSnapshotOverride(null)
      setDefinitionOverride(null)
      setProjectionReferenceDate(undefined)
      setError('正在审阅的历史版本已删除，已切回当前工作版本')
    }

    const handleWindowEvent = (event: Event) => {
      const historyVersionId = Number(
        (event as CustomEvent).detail?.historyVersionId,
      )

      if (Number.isInteger(historyVersionId))
        leaveDeletedHistory(historyVersionId)
    }

    window.addEventListener('resume-history-version-deleted', handleWindowEvent)

    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('resume-history-events')
        : null

    if (channel) {
      channel.onmessage = (event) => {
        const historyVersionId = Number(event.data?.historyVersionId)

        if (
          event.data?.type === 'history-version-deleted' &&
          Number.isInteger(historyVersionId)
        )
          leaveDeletedHistory(historyVersionId)
      }
    }

    return () => {
      window.removeEventListener(
        'resume-history-version-deleted',
        handleWindowEvent,
      )

      channel?.close()
    }
  }, [selectedKey])

  const selected =
    sources.find((source) => source.key === selectedKey) ?? sources[0]!

  const access = useMemo<CommentAccessContext>(() => {
    if (collaboratorMode && collaboratorAccess) return collaboratorAccess
    if (selected.kind === 'history')
      return { kind: 'owner', versionId: selected.historyVersionId }

    return { kind: 'owner', resumeId: resumeId ?? '' }
  }, [collaboratorAccess, collaboratorMode, resumeId, selected])

  return {
    sources,
    sourcesLoading,
    switching,
    error,
    selectedKey,
    access,
    snapshotOverride,
    definitionOverride,
    projectionReferenceDate,
    sourceLabel: selected.kind === 'working' ? workingLabel : selected.label,
    isWorking: selected.kind === 'working',
    selectSource,
  }
}
