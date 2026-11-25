import type { SubmissionFormProps } from './types'
import { useSubmissionForm } from './use-submission-form'
import type { SubmissionMaterialKind } from '../../../submission-types'
import { DURATION } from '@/lib/motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
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
import useTrackerStore from '../../../store'
import WorkflowDateField from '../workflow-date-field'

export function SubmissionForm({
  jobId,
  requestId,
  correctingRecord,
  onClose,
}: SubmissionFormProps) {
  const {
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
    retryVersions,
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
  } = useSubmissionForm({ jobId, requestId, correctingRecord, onClose })

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !busy && !uncertain) close()
      }}
    >
      <DialogContent
        style={{ animationDuration: `${reduce ? 0 : DURATION.base}s` }}
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
        className='flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-lg'
        showCloseButton={!busy && !uncertain}
      >
        <DialogHeader className='shrink-0 pr-7'>
          <DialogTitle>{correcting ? '更正原件' : '记录投递'}</DialogTitle>
          <DialogDescription>
            {job?.company} · {job?.position}
            。投递原件可以不附，更正已有原件时会保留历史。
          </DialogDescription>
        </DialogHeader>
        <div className='scrollbar-thin-subtle -mx-1 min-h-0 space-y-4 overflow-y-auto px-1'>
          <fieldset
            disabled={busy || uncertain || Boolean(savedRecord)}
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
                          ? { animationDuration: '0s', transform: 'none' }
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
                    <Select disabled>
                      <SelectTrigger
                        id='submission-resume'
                        className='w-full'
                        aria-busy='true'
                      >
                        <SelectValue placeholder='正在加载简历…' />
                      </SelectTrigger>
                    </Select>
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
                            ? { animationDuration: '0s', transform: 'none' }
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
                          ? { animationDuration: '0s', transform: 'none' }
                          : undefined
                      }
                    >
                      <SelectItem value='current'>
                        云端当前已保存内容
                      </SelectItem>
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
                    <div
                      role='alert'
                      className='flex flex-wrap items-center gap-2 text-xs'
                    >
                      <span className='text-destructive'>
                        历史版本加载失败：{versionsError}
                        。仍可使用云端当前内容。
                      </span>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={retryVersions}
                      >
                        重新读取历史版本
                      </Button>
                    </div>
                  ) : versions === null && resumeId ? (
                    <span
                      role='status'
                      aria-label='正在加载历史版本'
                      className='block'
                    >
                      <Skeleton className='h-3 w-28' />
                    </span>
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
        </div>
        <DialogFooter className='shrink-0 border-t pt-4'>
          <Button
            variant='outline'
            disabled={busy || uncertain}
            onClick={close}
          >
            {savedRecord ? '关闭' : '取消'}
          </Button>
          {uncertain && !correcting && (
            <Button variant='outline' disabled={busy} onClick={query}>
              查询保存结果
            </Button>
          )}
          <Button disabled={busy} onClick={savedRecord ? refreshSaved : save}>
            {savedRecord
              ? busy
                ? '正在读取…'
                : '重新读取职位'
              : busy
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
