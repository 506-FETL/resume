import type { SubmissionFormProps } from './types'
import type {
  JobSubmission,
  SubmissionMaterialKind,
} from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { listResumeHistoryVersions } from '@/lib/supabase/resume/history/queries'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history/types'
import {
  listJobSubmissions,
  correctJobSubmissionMaterial,
  SubmissionSaveError,
} from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import { useTrackerResumeOptions } from '../../../lib/resume-resources'
import useTrackerStore from '../../../store'
import { SubmissionRefreshError } from '../../../store/workflow-save'
import { getTrackerErrorMessage } from '../../../utils'

export function useSubmissionForm({
  jobId,
  requestId,
  correctingRecord,
  onClose,
}: SubmissionFormProps) {
  const correcting = Boolean(correctingRecord)
  const scope = getTrackerAccountScope()
  const reduce = useReducedMotion()
  const returnFocusRef = useRef(document.activeElement)
  const [open, setOpen] = useState(true)

  const close = () => setOpen(false)

  useEffect(() => {
    if (open) return

    const timer = setTimeout(onClose, reduce ? 0 : DURATION.base * 1000)

    return () => clearTimeout(timer)
  }, [open, onClose, reduce])

  const job = useTrackerStore((state) =>
    state.jobs.find((row) => row.id === jobId),
  )

  const {
    data: resumes,
    error: resumeError,
    retry,
  } = useTrackerResumeOptions(true)

  const [kind, setKind] = useState<SubmissionMaterialKind>(
    correcting ? 'platform' : 'pending',
  )

  const [resumeId, setResumeId] = useState(job?.resume_id ?? '')
  const [versionId, setVersionId] = useState('')

  const [versions, setVersions] = useState<
    ResumeHistoryVersionListItem[] | null
  >(null)

  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [file, setFile] = useState<File>()
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [channel, setChannel] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [savedRecord, setSavedRecord] = useState<JobSubmission | null>(null)

  const acceptSaved = (record: JobSubmission, rows?: JobSubmission[]) => {
    useTrackerStore.getState().notifySubmissionChanged(record, rows)
    setSavedRecord(record)
    setUncertain(false)
  }

  const refreshSaved = async () => {
    setBusy(true)
    setError(null)

    try {
      await useTrackerStore.getState().refreshSubmissionJob(jobId)

      if (isTrackerAccountScopeCurrent(scope)) close()
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope))
        setError(
          `投递已保存，但职位进度读取失败：${getTrackerErrorMessage(cause)}。请重新读取，无需再次提交。`,
        )
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  useEffect(() => {
    let active = true

    setVersionId('')
    setVersions(null)
    setVersionsError(null)

    if (kind === 'platform' && resumeId)
      listResumeHistoryVersions(resumeId)
        .then((rows) => {
          if (active && isTrackerAccountScopeCurrent(scope)) setVersions(rows)
        })
        .catch((cause) => {
          if (active && isTrackerAccountScopeCurrent(scope))
            setVersionsError(getTrackerErrorMessage(cause))
        })

    return () => {
      active = false
    }
  }, [kind, resumeId, scope])

  const save = async () => {
    if (!job || busy) return
    if (kind === 'platform' && !resumeId)
      return setError('请选择一份已保存的简历')
    if (kind === 'file' && !file) return setError('请选择 PDF 或 DOCX 原件')

    if (correcting && !reason.trim()) return setError('请填写更正原因')

    setBusy(true)
    setError(null)

    try {
      const material = {
        materialKind: kind,
        resumeId: kind === 'platform' ? resumeId : undefined,
        versionId:
          kind === 'platform' && versionId ? Number(versionId) : undefined,
        file: kind === 'file' ? file : undefined,
      }

      const saved = correctingRecord
        ? await correctJobSubmissionMaterial(
            correctingRecord.id,
            { ...material, jobId, reason: reason.trim() },
            createTrackerAccountGuard(scope),
          )
        : await useTrackerStore.getState().recordSubmission({
            ...material,
            id: requestId,
            jobId,
            submittedOn: date || null,
            channel: channel.trim() || null,
            note: note.trim() || null,
          })

      if (!isTrackerAccountScopeCurrent(scope)) return

      acceptSaved(saved)

      if (correctingRecord) await refreshSaved()
      else close()
    } catch (cause) {
      if (!isTrackerAccountScopeCurrent(scope)) return

      if (cause instanceof SubmissionRefreshError) {
        acceptSaved(cause.submission)
        setError(cause.message)

        return
      }

      const rejected =
        cause instanceof SubmissionSaveError && cause.outcome === 'rejected'

      setError(
        `${getTrackerErrorMessage(cause)}。${
          rejected
            ? '输入已保留，可修改后重试。'
            : correcting
              ? '输入已保留，可使用原编号重试。'
              : '输入已保留；先查询结果，再使用本次编号重试。'
        }`,
      )

      setUncertain(!rejected)
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  const query = async () => {
    setBusy(true)

    try {
      const rows = await listJobSubmissions(
        jobId,
        createTrackerAccountGuard(scope),
      )

      const found = rows.find(
        (row) => row.id === (correctingRecord?.id ?? requestId),
      )

      if (!isTrackerAccountScopeCurrent(scope)) return
      if (found && !correctingRecord) {
        acceptSaved(found, rows)
        await refreshSaved()
      } else setError('暂未查到本次保存结果，可使用原编号重试。')
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope))
        setError(getTrackerErrorMessage(cause))
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  return {
    correcting,
    reduce,
    returnFocusRef,
    open,
    close,
    job,
    resumes,
    resumeError,
    retry,
    kind,
    setKind,
    resumeId,
    setResumeId,
    versionId,
    setVersionId,
    versions,
    versionsError,
    file,
    setFile,
    date,
    setDate,
    channel,
    setChannel,
    note,
    setNote,
    reason,
    setReason,
    busy,
    error,
    setError,
    uncertain,
    savedRecord,
    refreshSaved,
    save,
    query,
  }
}
