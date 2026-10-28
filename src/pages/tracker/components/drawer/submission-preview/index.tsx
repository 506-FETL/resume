import type {
  JobSubmission,
  JobSubmissionMaterial,
} from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { getJobSubmissionMaterial } from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import { getTrackerErrorMessage } from '../../../utils'
import { SubmissionJdContent } from '../submission-jd'

export default function MaterialPreview({
  record,
  revisionId,
  onClose,
}: {
  record: JobSubmission
  revisionId?: string
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

    getJobSubmissionMaterial(
      record.id,
      createTrackerAccountGuard(scope),
      revisionId,
    )
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
  }, [record.id, revisionId, attempt])

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

          if (
            target instanceof HTMLElement &&
            target.isConnected &&
            target !== document.body &&
            target !== document.documentElement
          )
            target.focus({ preventScroll: true })
          else
            document
              .querySelector<HTMLButtonElement>(
                '[data-slot=drawer-content] button:not([disabled]), main button:not([disabled])',
              )
              ?.focus({ preventScroll: true })
        }}
        className='max-h-[90dvh] overflow-y-auto sm:max-w-4xl'
      >
        <DialogHeader>
          <DialogTitle>
            {revisionId ? '更正前的投递信息' : '投递原件'}
          </DialogTitle>
          <DialogDescription>
            查看本次保存的投递原件与 JD 副本。
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>投递原件加载失败</AlertTitle>
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
            正在加载投递原件
          </p>
        ) : (
          <>
            {revisionId && (
              <dl className='grid grid-cols-1 gap-3 text-sm sm:grid-cols-2'>
                <div className='space-y-1'>
                  <dt className='text-xs text-muted-foreground'>投递日期</dt>
                  <dd>{material.submittedOn ?? '日期未知'}</dd>
                </div>
                <div className='space-y-1'>
                  <dt className='text-xs text-muted-foreground'>投递渠道</dt>
                  <dd className='break-words'>
                    {material.channel ?? '未填写'}
                  </dd>
                </div>
                {material.note && (
                  <div className='space-y-1 sm:col-span-2'>
                    <dt className='text-xs text-muted-foreground'>备注</dt>
                    <dd className='whitespace-pre-wrap break-words'>
                      {material.note}
                    </dd>
                  </div>
                )}
              </dl>
            )}
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
                <Button
                  asChild
                  variant='outline'
                  className='h-auto min-h-9 max-w-full py-2 whitespace-normal'
                >
                  <a
                    href={url}
                    download={material.fileName}
                    className='break-all'
                  >
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
            <section className='space-y-2 border-t pt-4'>
              <h3 className='text-sm font-medium'>记录时保存的 JD</h3>
              <SubmissionJdContent
                jdText={material.jdText}
                jdUpdatedAt={material.jdUpdatedAt}
              />
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
