import type { JobSubmission } from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PaperSkeleton } from '@/components/loading-skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import useTrackerStore from '../../../store'
import { submissionMaterialKey } from '../../../store/submissions'
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
  const revision = useTrackerStore((state) => state.submissionRevision)

  const resource = useTrackerStore(
    (state) =>
      state.submissionMaterialsByKey[
        submissionMaterialKey(record.id, revisionId)
      ],
  )

  const material = resource?.data
  const error = resource?.error
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (open) return

    const timer = setTimeout(onClose, reduce ? 0 : DURATION.base * 1000)

    return () => clearTimeout(timer)
  }, [open, onClose, reduce])

  useEffect(() => {
    useTrackerStore.getState().loadSubmissionMaterial(record.id, revisionId)
  }, [record.id, revisionId, revision])

  useEffect(() => {
    if (material?.kind !== 'file') {
      setUrl(null)

      return
    }

    const objectUrl = URL.createObjectURL(material.file)

    setUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [material])

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setOpen(false)
      }}
    >
      <DialogContent
        style={{ animationDuration: `${reduce ? 0 : DURATION.base}s` }}
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
        className='flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-4xl'
      >
        <DialogHeader className='shrink-0 pr-7'>
          <DialogTitle>
            {revisionId ? '更正前的投递信息' : '投递原件'}
          </DialogTitle>
          <DialogDescription>
            查看本次保存的投递原件与 JD 副本。
          </DialogDescription>
        </DialogHeader>
        <div className='scrollbar-thin-subtle -mx-1 min-h-0 space-y-4 overflow-y-auto px-1'>
          <AnimatedContent
            animationKey={error ? 'error' : material ? 'ready' : 'loading'}
          >
            {error ? (
              <Alert variant='destructive'>
                <AlertTitle>投递原件加载失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button
                  variant='outline'
                  className='mt-2 w-fit'
                  onClick={(event) => {
                    event.currentTarget
                      .closest<HTMLElement>('[role="dialog"]')
                      ?.focus({ preventScroll: true })

                    useTrackerStore
                      .getState()
                      .loadSubmissionMaterial(record.id, revisionId)
                  }}
                >
                  重试
                </Button>
              </Alert>
            ) : !material ? (
              <PaperSkeleton
                label='正在加载投递原件'
                className='mx-auto max-w-lg'
              />
            ) : (
              <>
                {revisionId && (
                  <dl className='grid grid-cols-1 gap-3 text-sm sm:grid-cols-2'>
                    <div className='space-y-1'>
                      <dt className='text-xs text-muted-foreground'>
                        投递日期
                      </dt>
                      <dd>{material.submittedOn ?? '日期未知'}</dd>
                    </div>
                    <div className='space-y-1'>
                      <dt className='text-xs text-muted-foreground'>
                        投递渠道
                      </dt>
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
                  <div className='min-w-0 rounded-lg bg-muted/30 p-3'>
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
          </AnimatedContent>
        </div>
      </DialogContent>
    </Dialog>
  )
}
