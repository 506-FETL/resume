import type { JobSubmission } from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { resolveJobSubmission } from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

export function useSubmissionList(jobId: string, onViewDetails?: () => void) {
  const reduce = useReducedMotion()
  const resource = useTrackerStore((state) => state.submissionsByJob[jobId])
  const sectionRef = useRef<HTMLElement>(null)
  const editTriggerRef = useRef<HTMLButtonElement>(null)
  const historyTriggerRef = useRef<HTMLButtonElement>(null)
  const legacyTriggerRef = useRef<HTMLButtonElement>(null)

  const [viewing, setViewing] = useState<{
    record: JobSubmission
    revisionId?: string
  } | null>(null)

  const [materialEdit, setMaterialEdit] = useState<JobSubmission | null>(null)
  const [details, setDetails] = useState<JobSubmission | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    useTrackerStore.getState().loadSubmissions(jobId)
  }, [jobId, resource?.revision])

  const current = resource
  const data = resource?.data
  const primary = data?.kind === 'ready' ? data.primary : null
  const legacy = data && data.kind !== 'none' ? data.legacy : []
  const rows = !data ? null : primary ? [primary, ...legacy] : legacy
  const primaryId = primary?.id
  const compact = Boolean(onViewDetails)

  const historyResource = useTrackerStore((state) =>
    primaryId ? state.submissionHistoriesById[primaryId] : undefined,
  )

  const history = historyResource?.data
  const historyError = historyResource?.error

  useEffect(() => {
    if (!compact && primaryId && historyOpen)
      useTrackerStore.getState().loadSubmissionHistory(primaryId)
  }, [compact, primaryId, historyResource?.revision, historyOpen])

  const choose = async (row: JobSubmission) => {
    const scope = getTrackerAccountScope()
    let confirmed = row.is_primary

    sectionRef.current?.focus({ preventScroll: true })
    setBusy(true)
    setError(null)

    try {
      if (!confirmed) {
        const saved = await resolveJobSubmission(
          jobId,
          row.id,
          createTrackerAccountGuard(scope),
        )

        if (!isTrackerAccountScopeCurrent(scope)) return

        useTrackerStore.getState().notifySubmissionChanged(saved)
        confirmed = true
      }

      if (!isTrackerAccountScopeCurrent(scope)) return

      await useTrackerStore.getState().refreshSubmissionJob(jobId)
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope))
        setError(
          confirmed
            ? `投递已选定，但职位进度读取失败：${getTrackerErrorMessage(cause)}。`
            : getTrackerErrorMessage(cause),
        )
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  function openMaterial(target: typeof viewing) {
    if (target)
      useTrackerStore
        .getState()
        .loadSubmissionMaterial(target.record.id, target.revisionId)

    setViewing(target)
  }

  return {
    reduce,
    resource,
    sectionRef,
    editTriggerRef,
    historyTriggerRef,
    legacyTriggerRef,
    viewing,
    setViewing: openMaterial,
    materialEdit,
    setMaterialEdit,
    details,
    setDetails,
    historyOpen,
    setHistoryOpen,
    legacyOpen,
    setLegacyOpen,
    busy,
    error,
    current,
    primary,
    legacy,
    rows,
    compact,
    history,
    historyError,
    choose,
  }
}
