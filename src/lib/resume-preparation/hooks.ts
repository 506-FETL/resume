import type { PreparationRecord } from './types'
import type { VariantMetadata } from '@/lib/schema'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getAccessibleResumeById } from '@/lib/resume-access'
import useUserStore from '@/store/user'
import {
  flushPendingEvidence,
  getEvidenceRevision,
  subscribeEvidence,
} from './evidence'
import {
  getPreparationRevision,
  loadPreparation,
  subscribePreparation,
} from './storage'

export function usePreparationRecord(resumeId: string | null, enabled = true) {
  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const authStatus = useUserStore((state) => state.authStatus)

  const evidenceRevision = useSyncExternalStore(
    subscribeEvidence,
    getEvidenceRevision,
  )

  const revision = useSyncExternalStore(
    subscribePreparation,
    getPreparationRevision,
  )

  const [attempt, setAttempt] = useState(0)
  const key = `${ownerId ?? 'guest'}:${resumeId}:${enabled}:${authStatus}`

  const [state, setState] = useState<{
    key: string
    record: PreparationRecord | null
    loading: boolean
    refreshing: boolean
    revision: number
    evidenceRevision: number
    error: string | null
  }>({
    key: '',
    record: null,
    loading: true,
    refreshing: false,
    revision: -1,
    evidenceRevision: -1,
    error: null,
  })

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!enabled || !resumeId || authStatus === 'unknown') return

    let cancelled = false

    setState((previous) => ({
      key,
      record: previous.key === key ? previous.record : null,
      loading: previous.key !== key || !previous.record,
      refreshing: true,
      revision,
      evidenceRevision,
      error: null,
    }))

    flushPendingEvidence(resumeId, ownerId)
      .then(() => loadPreparation(resumeId, ownerId))
      .then((record) => {
        if (!cancelled)
          setState({
            key,
            record,
            loading: false,
            refreshing: false,
            revision,
            evidenceRevision,
            error: null,
          })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState((previous) => ({
            key,
            record: previous.key === key ? previous.record : null,
            loading: false,
            refreshing: false,
            revision,
            evidenceRevision,
            error: error instanceof Error ? error.message : '读取检查记录失败',
          }))
      })

    return () => {
      cancelled = true
    }
  }, [
    resumeId,
    ownerId,
    enabled,
    authStatus,
    key,
    revision,
    evidenceRevision,
    attempt,
  ])

  const current = state.key === key && authStatus !== 'unknown'

  return {
    record: current ? state.record : null,
    loading: !current || state.loading,
    refreshing:
      current &&
      (state.refreshing ||
        state.revision !== revision ||
        state.evidenceRevision !== evidenceRevision),
    error: current ? state.error : null,
    ownerId,
    retry,
  }
}

/** JD 派生证据从当前可访问的真实记录读取，读取失败时不把未知当作没有 AI。 */
export function useDerivedMetadata(resumeId: string | null, enabled: boolean) {
  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const [attempt, setAttempt] = useState(0)
  const key = `${ownerId ?? 'guest'}:${resumeId}:${enabled}`

  const [state, setState] = useState<{
    key: string
    metadata: VariantMetadata | null
    loading: boolean
    error: string | null
  }>({ key: '', metadata: null, loading: true, error: null })

  useEffect(() => {
    if (!enabled || !resumeId) return

    let cancelled = false

    setState({ key, metadata: null, loading: true, error: null })

    getAccessibleResumeById(resumeId)
      .then((record) => {
        if (!cancelled)
          setState({
            key,
            metadata:
              (record.derived_metadata as VariantMetadata | null) ?? null,
            loading: false,
            error: null,
          })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            key,
            metadata: null,
            loading: false,
            error: error instanceof Error ? error.message : '读取 AI 来源失败',
          })
      })

    return () => {
      cancelled = true
    }
  }, [enabled, resumeId, ownerId, key, attempt])

  return {
    metadata: state.key === key ? state.metadata : null,
    loading: state.key !== key || state.loading,
    error: state.key === key ? state.error : null,
    retry: () => setAttempt((value) => value + 1),
  }
}
