import type {
  JobSubmission,
  JobSubmissionMaterial,
} from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import {
  getJobSubmissionMaterial,
  listJobSubmissions,
} from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import { SubmissionForm } from '../submission-dialog'

const MotionCard = motion.create(Card)

function MaterialPreview({
  record,
  onClose,
}: {
  record: JobSubmission
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const returnFocusRef = useRef(document.activeElement)
  const [open, setOpen] = useState(true)
  const [material, setMaterial] = useState<JobSubmissionMaterial | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (open) return

    const timer = setTimeout(onClose, reduce ? 0 : DURATION.base * 1000)

    return () => clearTimeout(timer)
  }, [open, onClose, reduce])

  useEffect(() => {
    const scope = getTrackerAccountScope()
    let active = true
    let objectUrl: string | null = null

    setError(null)

    getJobSubmissionMaterial(record.id, createTrackerAccountGuard(scope))
      .then((result) => {
        if (!active || !isTrackerAccountScopeCurrent(scope)) return

        setMaterial(result)

        if (result.kind === 'file') {
          objectUrl = URL.createObjectURL(result.file)
          setUrl(objectUrl)
        }
      })
      .catch((cause) => {
        if (active && isTrackerAccountScopeCurrent(scope))
          setError(getTrackerErrorMessage(cause))
      })

    return () => {
      active = false

      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [record.id, attempt])

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setOpen(false)
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
        className='max-h-[90dvh] overflow-y-auto sm:max-w-4xl'
      >
        <DialogHeader>
          <DialogTitle>投递留档</DialogTitle>
          <DialogDescription>
            {record.submitted_on ?? '投递日期未知'} ·{' '}
            {record.channel ?? '渠道未知'}。这里展示留档材料和记录时保存的 JD。
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>留档加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant='outline'
              className='mt-2 w-fit'
              onClick={() => setAttempt((value) => value + 1)}
            >
              重试
            </Button>
          </Alert>
        ) : !material ? (
          <p
            role='status'
            className='flex items-center gap-2 text-sm text-muted-foreground'
          >
            <Spinner aria-hidden className='motion-reduce:animate-none' />
            正在加载留档
          </p>
        ) : (
          <>
            <div className='text-xs text-muted-foreground'>
              记录于 {new Date(record.created_at).toLocaleString()}
              {record.supplemented_at &&
                ` · 材料补充于 ${new Date(record.supplemented_at).toLocaleString()}`}
            </div>
            {material.kind === 'platform' && (
              <div className='h-[60dvh] overflow-y-auto bg-muted/30 p-3'>
                <ScaledReadonlyPreview
                  data={buildTemplateResumeData(material.snapshot)}
                  appearance={material.snapshot}
                  projectionReferenceDate={material.projectionReferenceDate}
                  definition={material.definition}
                />
              </div>
            )}
            {material.kind === 'file' && url && (
              <>
                <Button asChild variant='outline'>
                  <a href={url} download={material.fileName}>
                    下载原件：{material.fileName}
                  </a>
                </Button>
                {material.fileMime === 'application/pdf' && (
                  <iframe
                    title='投递 PDF 原件'
                    src={url}
                    className='h-[60dvh] w-full rounded-lg border'
                  />
                )}
              </>
            )}
            {material.kind === 'pending' && <p>本次投递尚未补充材料。</p>}
            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>记录时保存的 JD</h3>
              <p className='text-xs text-muted-foreground'>
                {material.jdUpdatedAt
                  ? `此 JD 更新于 ${new Date(material.jdUpdatedAt).toLocaleString()}；后续修改不影响这份副本。`
                  : '未记录 JD 更新时间。'}
                {' 投递当时的 JD 无法确认。'}
              </p>
              <p className='max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm'>
                {material.jdText || '没有 JD 原文'}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function SubmissionList({ jobId }: { jobId: string }) {
  const reduce = useReducedMotion()
  const revision = useTrackerStore((state) => state.submissionRevision)
  const [rows, setRows] = useState<JobSubmission[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [viewing, setViewing] = useState<JobSubmission | null>(null)
  const [supplement, setSupplement] = useState<JobSubmission | null>(null)

  useEffect(() => {
    const scope = getTrackerAccountScope()
    let active = true

    setError(null)

    listJobSubmissions(jobId, createTrackerAccountGuard(scope))
      .then((result) => {
        if (active && isTrackerAccountScopeCurrent(scope)) setRows(result)
      })
      .catch((cause) => {
        if (active && isTrackerAccountScopeCurrent(scope))
          setError(getTrackerErrorMessage(cause))
      })

    return () => {
      active = false
    }
  }, [jobId, revision, attempt])

  return (
    <Card size='sm' className='gap-3'>
      <CardHeader className='flex items-center justify-between gap-3'>
        <CardTitle>投递记录</CardTitle>
        <Button
          size='sm'
          onClick={() => {
            useTrackerStore.getState().requestSubmission(jobId)
          }}
        >
          记录投递
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>投递记录加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant='outline'
              size='sm'
              className='mt-2 w-fit'
              onClick={() => setAttempt((value) => value + 1)}
            >
              重新加载
            </Button>
          </Alert>
        ) : rows === null ? (
          <p
            role='status'
            className='flex items-center gap-2 text-sm text-muted-foreground'
          >
            <Spinner aria-hidden className='motion-reduce:animate-none' />
            正在加载投递记录
          </p>
        ) : rows.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            还没有投递记录。准备、导出简历或创建分享后，仍需在实际投递时记录。
          </p>
        ) : (
          rows.map((row) => (
            <MotionCard
              role='article'
              size='sm'
              initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduce ? 0 : DURATION.base,
                ease: EASE.out,
              }}
              key={row.id}
              className='gap-2 rounded-lg p-3 text-sm shadow-none'
            >
              <p>
                {row.submitted_on ?? '日期未知'} · {row.channel ?? '渠道未知'}
              </p>
              <p className='break-all text-xs text-muted-foreground'>
                {row.material_kind === 'pending'
                  ? '材料待补'
                  : row.material_kind === 'platform'
                    ? '平台简历快照'
                    : row.file_name}
              </p>
              {row.note && (
                <p className='whitespace-pre-wrap break-words'>{row.note}</p>
              )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setViewing(row)}
                >
                  查看留档
                </Button>
                {row.material_kind === 'pending' && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setSupplement(row)}
                  >
                    补充材料
                  </Button>
                )}
              </div>
            </MotionCard>
          ))
        )}
      </CardContent>
      {viewing && (
        <MaterialPreview
          key={viewing.id}
          record={viewing}
          onClose={() => setViewing(null)}
        />
      )}
      {supplement && (
        <SubmissionForm
          key={supplement.id}
          jobId={jobId}
          requestId={supplement.id}
          supplement={supplement}
          onClose={() => {
            setSupplement(null)
            setAttempt((value) => value + 1)
          }}
        />
      )}
    </Card>
  )
}
