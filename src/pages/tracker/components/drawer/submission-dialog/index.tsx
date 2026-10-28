import type {
  JobSubmission,
  SubmissionMaterialKind,
} from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { DURATION } from '@/lib/motion'
import AnimatedContent from '@/components/motion/animated-content'
import { listResumeHistoryVersions } from '@/lib/supabase/resume/history'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history/types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { getTrackerErrorMessage } from '../../../utils'
import WorkflowDateField from '../workflow-date-field'

interface Props {
  jobId: string
  requestId: string
  correctingRecord?: JobSubmission
  onClose: () => void
}

export function SubmissionForm({
  jobId,
  requestId,
  correctingRecord,
  onClose,
}: Props) {
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

      if (correctingRecord)
        await correctJobSubmissionMaterial(
          correctingRecord.id,
          { ...material, jobId, reason: reason.trim() },
          createTrackerAccountGuard(scope),
        )
      else
        await useTrackerStore.getState().recordSubmission({
          ...material,
          id: requestId,
          jobId,
          submittedOn: date || null,
          channel: channel.trim() || null,
          note: note.trim() || null,
        })

      if (!isTrackerAccountScopeCurrent(scope)) return

      useTrackerStore.getState().notifySubmissionChanged()
      await useTrackerStore.getState().reloadJobs()
      close()
    } catch (cause) {
      if (!isTrackerAccountScopeCurrent(scope)) return

      const rejected =
        cause instanceof SubmissionSaveError && cause.outcome === 'rejected'

      setError(
        `${getTrackerErrorMessage(cause)}。${rejected ? '输入已保留，可修改后重试。' : '输入已保留；先查询结果，再使用本次编号重试。'}`,
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
      if (found && (!correctingRecord || found.material_kind !== 'pending')) {
        await useTrackerStore.getState().reloadJobs()
        close()
      } else setError('暂未查到本次保存结果，可使用原编号重试。')
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope))
        setError(getTrackerErrorMessage(cause))
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !busy && !uncertain) close()
      }}
    >
      <DialogContent
        style={{ animationDuration: `${reduce ? 0 : DURATION.base}s` }}
        overlayClassName={reduce ? 'animate-none!' : undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          const target = returnFocusRef.current

          if (target instanceof HTMLElement && target.isConnected)
            target.focus({ preventScroll: true })
          else
            document
              .querySelector<HTMLButtonElement>('main button:not([disabled])')
              ?.focus({ preventScroll: true })
        }}
        className='max-h-[90dvh] overflow-y-auto sm:max-w-lg'
        showCloseButton={!busy && !uncertain}
      >
        <DialogHeader>
          <DialogTitle>{correcting ? '更正原件' : '记录投递'}</DialogTitle>
          <DialogDescription>
            {job?.company} · {job?.position}
            。投递原件可以不附，更正已有原件时会保留历史。
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={busy || uncertain}
          className='space-y-4 disabled:opacity-70'
        >
          {!correctingRecord && (
            <>
              <div className='space-y-2'>
                <WorkflowDateField
                  label='投递日期'
                  value={date || null}
                  onChange={(value) => setDate(value ?? '')}
                />
                <p className='text-xs text-muted-foreground'>
                  清除日期表示投递时间未知。
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='submission-channel'>投递渠道（选填）</Label>
                <Input
                  id='submission-channel'
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='submission-note'>备注（选填）</Label>
                <Textarea
                  id='submission-note'
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </>
          )}
          {correcting && (
            <div className='space-y-2'>
              <Label htmlFor='material-correction-reason'>更正原因</Label>
              <Textarea
                id='material-correction-reason'
                value={reason}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          )}
          {!correcting && (
            <div className='flex items-center gap-2'>
              <Checkbox
                id='submission-attach'
                checked={kind !== 'pending'}
                onCheckedChange={(checked) =>
                  setKind(checked ? 'platform' : 'pending')
                }
              />
              <Label htmlFor='submission-attach'>附上投递原件（可选）</Label>
            </div>
          )}
          <AnimatedContent
            animationKey={kind === 'pending' ? 'none' : 'attached'}
          >
            {kind !== 'pending' && (
              <div className='space-y-2'>
                <Label htmlFor='submission-kind'>原件来源</Label>
                <Select
                  value={kind}
                  onValueChange={(value) =>
                    setKind(value as SubmissionMaterialKind)
                  }
                >
                  <SelectTrigger id='submission-kind' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={
                      reduce
                        ? { animation: 'none', transform: 'none' }
                        : undefined
                    }
                  >
                    <SelectItem value='platform'>平台已保存版本</SelectItem>
                    <SelectItem value='file'>上传原件</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </AnimatedContent>
          <AnimatedContent animationKey={kind}>
            {kind === 'platform' && (
              <div className='space-y-2'>
                <Label htmlFor='submission-resume'>已保存的简历</Label>
                {resumeError ? (
                  <Alert variant='destructive'>
                    <AlertDescription>{resumeError}</AlertDescription>
                    <Button
                      variant='outline'
                      className='mt-2 w-fit'
                      onClick={retry}
                    >
                      重试
                    </Button>
                  </Alert>
                ) : !resumes ? (
                  <p
                    role='status'
                    className='flex items-center gap-2 text-sm text-muted-foreground'
                  >
                    <Spinner
                      aria-hidden
                      className='motion-reduce:animate-none'
                    />
                    正在加载简历
                  </p>
                ) : resumes.length === 0 ? (
                  <p>
                    {correcting
                      ? '没有可用的已保存简历，可上传原件。'
                      : '没有可用的已保存简历，可上传原件，也可取消附上原件后直接记录投递。'}
                  </p>
                ) : (
                  <Select value={resumeId} onValueChange={setResumeId}>
                    <SelectTrigger id='submission-resume' className='w-full'>
                      <SelectValue placeholder='选择简历' />
                    </SelectTrigger>
                    <SelectContent
                      style={
                        reduce
                          ? { animation: 'none', transform: 'none' }
                          : undefined
                      }
                    >
                      {resumes.map((resume) => (
                        <SelectItem
                          key={resume.resume_id}
                          value={resume.resume_id}
                        >
                          {resume.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Label htmlFor='submission-version'>已保存版本</Label>
                <Select
                  value={versionId || 'current'}
                  onValueChange={(value) =>
                    setVersionId(value === 'current' ? '' : value)
                  }
                >
                  <SelectTrigger id='submission-version' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={
                      reduce
                        ? { animation: 'none', transform: 'none' }
                        : undefined
                    }
                  >
                    <SelectItem value='current'>云端当前已保存内容</SelectItem>
                    {versions?.map((version) => (
                      <SelectItem key={version.id} value={String(version.id)}>
                        V{version.version_no}
                        {version.version_name
                          ? ` · ${version.version_name}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {versionsError ? (
                  <p role='alert' className='text-xs text-destructive'>
                    历史版本加载失败：{versionsError}
                    。可重新选择简历重试，或使用云端当前内容。
                  </p>
                ) : versions === null && resumeId ? (
                  <p role='status' className='text-xs text-muted-foreground'>
                    正在加载历史版本
                  </p>
                ) : null}
                <p className='text-xs text-muted-foreground'>
                  未保存的编辑不会进入留档。
                </p>
              </div>
            )}
            {kind === 'file' && (
              <div className='space-y-2'>
                <Label htmlFor='submission-file'>
                  PDF / DOCX，每份不超过 10 MB
                </Label>
                <Input
                  id='submission-file'
                  type='file'
                  accept='.pdf,.docx'
                  onChange={(event) => {
                    const candidate = event.target.files?.[0]

                    if (
                      candidate &&
                      (!/\.(pdf|docx)$/i.test(candidate.name) ||
                        candidate.size > 10 * 1024 * 1024)
                    ) {
                      setFile(undefined)
                      event.target.value = ''
                      setError('请选择 10 MB 以内的 PDF 或 DOCX 文件')

                      return
                    }

                    setFile(candidate)
                    setError(null)
                  }}
                />
                {file && <p className='break-all text-xs'>{file.name}</p>}
              </div>
            )}
          </AnimatedContent>
        </fieldset>
        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {uncertain && (
          <p className='break-all text-xs text-muted-foreground'>
            本次操作编号：{correctingRecord?.id ?? requestId}
          </p>
        )}
        <DialogFooter>
          <Button
            variant='outline'
            disabled={busy || uncertain}
            onClick={close}
          >
            取消
          </Button>
          {uncertain && !correcting && (
            <Button variant='outline' disabled={busy} onClick={query}>
              查询保存结果
            </Button>
          )}
          <Button disabled={busy} onClick={save}>
            {busy
              ? '正在保存…'
              : uncertain
                ? '使用原编号重试'
                : correctingRecord
                  ? '保存更正'
                  : '确认已投递'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SubmissionDialog() {
  const current = useTrackerStore((state) => state.submissionQueue[0])

  if (!current) return null

  return (
    <SubmissionForm
      key={current.id}
      jobId={current.jobId}
      requestId={current.id}
      onClose={() => useTrackerStore.getState().finishSubmission()}
    />
  )
}
