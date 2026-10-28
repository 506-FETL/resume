import type { PreparationRecord } from '@/lib/resume-preparation/types'
import type { ResumeCheckResult } from '@/lib/resume-checks/types'
import { useEffect, useRef } from 'react'
import { useDebouncedValue } from '@/hooks/use-debounce'
import { checkResume } from '@/lib/resume-checks/rules'
import { derivedEvidence } from '@/lib/resume-preparation/evidence'
import {
  useDerivedMetadata,
  usePreparationRecord,
} from '@/lib/resume-preparation/hooks'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { cancelProofreading } from '../utils/check-actions'
import { useResumeCheckStore } from '../store/checks'
import { useResumeReviewStore } from '../review-store'

const emptyRecord: PreparationRecord = { evidence: [], resolutions: {} }
const INPUT_CHECK_DELAY = 250

/** 编辑器只挂载一次；侧栏与导出共享检查结果和请求状态。 */
export function useResumeChecks() {
  const form = useResumeStore()

  useResumeConfigStore()

  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const resumeId = form.currentResumeId
  const identity = `${ownerId ?? 'guest'}:${resumeId}`
  const preparation = usePreparationRecord(resumeId, form.isInitialized)
  const derived = useDerivedMetadata(resumeId, form.isInitialized)
  const revision = useResumeCheckStore((state) => state.revision)
  const proofreadIssues = useResumeCheckStore((state) => state.proofreadIssues)
  const layoutIssues = useResumeCheckStore((state) => state.layoutIssues)

  const layoutSignature = useResumeCheckStore(
    (state) => state.layoutSnapshotSignature,
  )

  const review = useResumeReviewStore((state) => state.active)

  const snapshot = form.isInitialized ? form.getPersistedSnapshot() : null

  const snapshotSignature = snapshot ? JSON.stringify(snapshot) : ''
  const inputKey = JSON.stringify([identity, snapshotSignature])
  const settledInput = useDebouncedValue(inputKey, INPUT_CHECK_DELAY)

  const rulesCacheRef = useRef<{
    key: string
    result: ResumeCheckResult
  } | null>(null)

  useEffect(() => {
    const state = useResumeCheckStore.getState()

    if (
      state.identity !== identity ||
      !state.proofreadSignature ||
      state.proofreadSignature === snapshotSignature
    )
      return

    if (state.proofreadStatus === 'running') cancelProofreading('stale')
    else if (
      state.proofreadStatus !== 'idle' &&
      state.proofreadStatus !== 'stale'
    )
      useResumeCheckStore.setState({ proofreadStatus: 'stale' })
  }, [identity, snapshotSignature])

  useEffect(() => {
    if (review) cancelProofreading()
  }, [review])

  useEffect(() => {
    if (!resumeId) return

    cancelProofreading()
    rulesCacheRef.current = null
    useResumeCheckStore.getState().reset(identity, resumeId, ownerId)

    return () => {
      cancelProofreading()
    }
  }, [identity, ownerId, resumeId])

  useEffect(() => {
    if (!revision) return

    preparation.retry()
    derived.retry()
    // 只有用户主动重新检查时重读来源，不能随 hook 返回函数的身份变化重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision])

  useEffect(() => {
    if (
      !resumeId ||
      !form.isInitialized ||
      !snapshot ||
      settledInput !== inputKey
    )
      return

    const state = useResumeCheckStore.getState()

    if (state.identity !== identity) return

    const sourceError = preparation.error ?? derived.error
    const sourceLoading = preparation.loading || derived.loading
    const base = preparation.record ?? emptyRecord

    const record = {
      ...base,
      evidence: [
        ...new Map(
          [
            ...derivedEvidence(derived.metadata, snapshot),
            ...base.evidence,
          ].map((item) => [item.id, item]),
        ).values(),
      ],
    }

    const outdated =
      !!state.proofreadSignature &&
      state.proofreadSignature !== snapshotSignature

    if (outdated && state.proofreadStatus === 'running')
      cancelProofreading('stale')

    try {
      // 排版结果变化只重新合并，不重复执行文字、日期及来源规则。
      const rulesKey = JSON.stringify([
        identity,
        snapshotSignature,
        record.evidence,
        record.resolutions,
        revision,
      ])

      if (rulesCacheRef.current?.key !== rulesKey)
        rulesCacheRef.current = {
          key: rulesKey,
          result: checkResume(snapshot, record),
        }

      const result = rulesCacheRef.current.result

      const aiIssues = outdated
        ? []
        : proofreadIssues.map((issue) => ({
            ...issue,
            resolved:
              record.resolutions[issue.id]?.signature === issue.signature,
          }))

      const ruleTargets = new Set(
        result.issues.flatMap((issue) =>
          issue.targets.map((target) =>
            JSON.stringify([target.section, target.path, target.quote]),
          ),
        ),
      )

      const distinctAiIssues = aiIssues.filter(
        (issue) =>
          !issue.targets.every((target) =>
            ruleTargets.has(
              JSON.stringify([target.section, target.path, target.quote]),
            ),
          ),
      )

      const issues = [
        ...result.issues,
        ...distinctAiIssues,
        ...(state.layoutSnapshotSignature === snapshotSignature
          ? layoutIssues
          : []
        ).map((issue) => ({
          ...issue,
          resolved: record.resolutions[issue.id]?.signature === issue.signature,
        })),
      ]

      useResumeCheckStore.setState({
        snapshotSignature,
        issues:
          JSON.stringify(issues) === JSON.stringify(state.issues)
            ? state.issues
            : issues,
        aiCount: result.aiEvidence.length,
        record,
        sourceStatus: sourceError
          ? 'error'
          : sourceLoading
            ? 'loading'
            : 'ready',
        sourceError,
        ruleStatus: 'ready',
        ruleError: null,
        ...(outdated && state.proofreadStatus !== 'idle'
          ? { proofreadStatus: 'stale' as const }
          : {}),
      })
    } catch (error) {
      useResumeCheckStore.setState({
        snapshotSignature,
        issues: [],
        ruleStatus: 'error',
        ruleError:
          error instanceof Error ? error.message : '检查未完成，请重试',
        sourceStatus: sourceError
          ? 'error'
          : sourceLoading
            ? 'loading'
            : 'ready',
        sourceError,
      })
    }
    // 停笔后仅检查当前快照，排版变化复用文字规则结果。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    identity,
    resumeId,
    form.isInitialized,
    snapshotSignature,
    inputKey,
    settledInput,
    derived.metadata,
    preparation.record,
    preparation.loading,
    preparation.refreshing,
    preparation.error,
    derived.loading,
    derived.error,
    proofreadIssues,
    layoutIssues,
    layoutSignature,
    revision,
  ])
}
