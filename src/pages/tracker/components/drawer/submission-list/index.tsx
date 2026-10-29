import type {
  JobSubmission,
  SubmissionRevision,
} from '../../../submission-types'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Pencil } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Spinner } from '@/components/ui/spinner'
import {
  listJobSubmissionRevisions,
  resolveJobSubmission,
} from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import { SubmissionForm } from '../submission-dialog'
import SubmissionDetails from '../submission-details'
import SubmissionFileRow from '../submission-file-row'
import SubmissionJd from '../submission-jd'
import MaterialPreview from '../submission-preview'

function RecordFacts({ record }: { record: JobSubmission }) {
  return (
    <dl className='grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2'>
      <div className='space-y-1'>
        <dt className='text-xs text-muted-foreground'>投递日期</dt>
        <dd>{record.submitted_on ?? '日期未知'}</dd>
      </div>
      <div className='min-w-0 space-y-1'>
        <dt className='text-xs text-muted-foreground'>投递渠道</dt>
        <dd className='break-words'>{record.channel ?? '未填写'}</dd>
      </div>
      {record.note && (
        <div className='min-w-0 space-y-1 sm:col-span-2'>
          <dt className='text-xs text-muted-foreground'>备注</dt>
          <dd className='whitespace-pre-wrap break-words'>{record.note}</dd>
        </div>
      )}
    </dl>
  )
}

function RecordJd({ recordId }: { recordId: string }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (!next) triggerRef.current?.focus({ preventScroll: true })

        setOpen(next)
      }}
    >
      <CollapsibleTrigger asChild>
        <Button
          ref={triggerRef}
          size='sm'
          variant='ghost'
          className='group text-muted-foreground focus-visible:ring-inset'
        >
          <ChevronDown
            aria-hidden
            className='transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none'
            style={{ transitionDuration: `${reduce ? 0 : DURATION.fast}s` }}
          />
          记录时保存的 JD
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        inert={!open}
        aria-hidden={!open || undefined}
        className='motion-reduce:animate-none'
      >
        <div className='pt-2'>
          <SubmissionJd
            recordId={recordId}
            enabled={open}
            onRetry={() => triggerRef.current?.focus({ preventScroll: true })}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function SubmissionList({
  jobId,
  onViewDetails,
}: {
  jobId: string
  onViewDetails?: () => void
}) {
  const reduce = useReducedMotion()
  const revision = useTrackerStore((state) => state.submissionRevision)
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
  const [history, setHistory] = useState<SubmissionRevision[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    useTrackerStore.getState().loadSubmissions(jobId)
  }, [jobId, revision])

  const data = resource?.data
  const primary = data?.kind === 'ready' ? data.primary : null
  const legacy = data && data.kind !== 'none' ? data.legacy : []
  const rows = !data ? null : primary ? [primary, ...legacy] : legacy
  const primaryId = primary?.id
  const compact = Boolean(onViewDetails)

  useEffect(() => {
    if (compact || !primaryId) return

    const scope = getTrackerAccountScope()
    let active = true

    setHistory(null)
    setHistoryError(null)

    listJobSubmissionRevisions(primaryId, createTrackerAccountGuard(scope))
      .then((result) => {
        if (active && isTrackerAccountScopeCurrent(scope)) setHistory(result)
      })
      .catch((cause) => {
        if (active && isTrackerAccountScopeCurrent(scope))
          setHistoryError(getTrackerErrorMessage(cause))
      })

    return () => {
      active = false
    }
  }, [compact, primaryId, revision, historyAttempt])

  const choose = async (row: JobSubmission) => {
    const scope = getTrackerAccountScope()

    sectionRef.current?.focus({ preventScroll: true })
    setBusy(true)
    setError(null)

    try {
      await resolveJobSubmission(
        jobId,
        row.id,
        createTrackerAccountGuard(scope),
      )

      if (!isTrackerAccountScopeCurrent(scope)) return

      useTrackerStore.getState().notifySubmissionChanged()
      await useTrackerStore.getState().reloadJobs()
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope))
        setError(getTrackerErrorMessage(cause))
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  const readonlyRecord = (row: JobSubmission) => (
    <article
      key={row.id}
      className='space-y-3 border-t py-4 first:border-t-0 first:pt-1'
    >
      <RecordFacts record={row} />
      {row.material_kind !== 'pending' && (
        <SubmissionFileRow
          record={row}
          onPreview={() => setViewing({ record: row })}
        />
      )}
      <RecordJd recordId={row.id} />
      {!primary && (
        <Button size='sm' disabled={busy} onClick={() => choose(row)}>
          选为本岗位的投递
        </Button>
      )}
    </article>
  )

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label={compact ? '投递原件' : '投递详情'}
      className='min-w-0 space-y-4 px-1 py-1 outline-none'
    >
      {!compact && (
        <div className='flex items-center justify-between gap-3'>
          <h3 className='text-base font-semibold'>投递详情</h3>
          {primary ? (
            <Button
              ref={editTriggerRef}
              size='sm'
              variant='ghost'
              onClick={() => setDetails(primary)}
            >
              <Pencil aria-hidden className='size-3.5' />
              编辑
            </Button>
          ) : rows?.length === 0 && !resource?.loading ? (
            <Button
              size='sm'
              onClick={() =>
                useTrackerStore.getState().requestSubmission(jobId)
              }
            >
              记录投递
            </Button>
          ) : null}
        </div>
      )}
      <AnimatedContent
        animationKey={
          resource?.error
            ? 'error'
            : !rows
              ? 'loading'
              : primary
                ? `primary-${primary.id}`
                : rows.length
                  ? 'resolve'
                  : 'empty'
        }
      >
        {resource?.error ? (
          <Alert variant='destructive'>
            <AlertTitle>
              {compact ? '投递原件加载失败' : '投递详情加载失败'}
            </AlertTitle>
            <AlertDescription>{resource.error}</AlertDescription>
            <Button
              size='sm'
              variant='outline'
              className='mt-2 w-fit'
              onClick={() => {
                sectionRef.current?.focus({ preventScroll: true })
                useTrackerStore.getState().loadSubmissions(jobId)
              }}
            >
              重新加载
            </Button>
          </Alert>
        ) : !rows ? (
          <p
            role='status'
            className='flex items-center gap-2 text-sm text-muted-foreground'
          >
            <Spinner aria-hidden className='motion-reduce:animate-none' />
            {compact ? '正在读取投递原件' : '正在加载投递详情'}
          </p>
        ) : compact ? (
          <div className='space-y-2'>
            {(primary ? [primary] : legacy)
              .filter((row) => row.material_kind !== 'pending')
              .map((row) => (
                <SubmissionFileRow
                  key={row.id}
                  record={row}
                  onPreview={() => setViewing({ record: row })}
                />
              ))}
          </div>
        ) : primary ? (
          <div className='space-y-4'>
            <RecordFacts record={primary} />
            {primary.material_kind !== 'pending' && (
              <SubmissionFileRow
                record={primary}
                onPreview={() => setViewing({ record: primary })}
                onCorrect={() => setMaterialEdit(primary)}
              />
            )}
            <div className='space-y-2 border-t pt-3'>
              <RecordJd
                key={`${primary.id}-${revision}`}
                recordId={primary.id}
              />
              <AnimatedContent
                animationKey={
                  historyError
                    ? 'error'
                    : history
                      ? history.length
                        ? 'history'
                        : 'empty'
                      : 'loading'
                }
              >
                {historyError ? (
                  <Alert variant='destructive'>
                    <AlertTitle>更正历史加载失败</AlertTitle>
                    <AlertDescription>{historyError}</AlertDescription>
                    <Button
                      size='sm'
                      variant='outline'
                      className='mt-2 w-fit'
                      onClick={() => {
                        sectionRef.current?.focus({ preventScroll: true })
                        setHistoryAttempt((value) => value + 1)
                      }}
                    >
                      重试
                    </Button>
                  </Alert>
                ) : !history ? (
                  <p
                    role='status'
                    className='flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground'
                  >
                    <Spinner
                      aria-hidden
                      className='size-3 motion-reduce:animate-none'
                    />
                    正在读取更正历史
                  </p>
                ) : history.length > 0 ? (
                  <Collapsible
                    open={historyOpen}
                    onOpenChange={(next) => {
                      if (!next)
                        historyTriggerRef.current?.focus({
                          preventScroll: true,
                        })

                      setHistoryOpen(next)
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        ref={historyTriggerRef}
                        size='sm'
                        variant='ghost'
                        className='group text-muted-foreground focus-visible:ring-inset'
                      >
                        <ChevronDown
                          aria-hidden
                          className='transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none'
                          style={{
                            transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
                          }}
                        />
                        更正历史（{history.length}）
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent
                      inert={!historyOpen}
                      aria-hidden={!historyOpen || undefined}
                      className='motion-reduce:animate-none'
                    >
                      <ul className='space-y-2 px-1 pt-2 pb-1'>
                        {history.map((entry) => (
                          <li
                            key={entry.id}
                            className='flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0'
                          >
                            <div className='min-w-0 flex-1 basis-40 space-y-1'>
                              <p className='whitespace-pre-wrap break-words text-sm'>
                                {entry.reason}
                              </p>
                              <p className='text-xs text-muted-foreground'>
                                {new Date(entry.created_at).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              size='sm'
                              variant='ghost'
                              className='focus-visible:ring-inset'
                              onClick={() =>
                                setViewing({
                                  record: primary,
                                  revisionId: entry.id,
                                })
                              }
                            >
                              查看更正前信息
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </AnimatedContent>
              {legacy.length > 0 && (
                <Collapsible
                  open={legacyOpen}
                  onOpenChange={(next) => {
                    if (!next)
                      legacyTriggerRef.current?.focus({ preventScroll: true })

                    setLegacyOpen(next)
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      ref={legacyTriggerRef}
                      size='sm'
                      variant='ghost'
                      className='group text-muted-foreground focus-visible:ring-inset'
                    >
                      <ChevronDown
                        aria-hidden
                        className='transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none'
                        style={{
                          transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
                        }}
                      />
                      旧版历史记录（{legacy.length}）
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    inert={!legacyOpen}
                    aria-hidden={!legacyOpen || undefined}
                    className='motion-reduce:animate-none'
                  >
                    <div className='px-1 pt-2 pb-1'>
                      {legacy.map(readonlyRecord)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        ) : rows.length ? (
          <div className='space-y-3'>
            <p className='text-sm text-muted-foreground'>
              这个岗位有多份历史记录。请选择实际投递的一份，其余记录仍可查看，不会删除。
            </p>
            {rows.map(readonlyRecord)}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>
            尚未记录投递，实际投递后可在这里记录日期和渠道。
          </p>
        )}
      </AnimatedContent>
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {viewing && (
        <MaterialPreview
          key={viewing.revisionId ?? viewing.record.id}
          {...viewing}
          onClose={() => setViewing(null)}
        />
      )}
      {materialEdit && (
        <SubmissionForm
          key={materialEdit.id}
          jobId={jobId}
          requestId={materialEdit.id}
          correctingRecord={materialEdit}
          onClose={() => setMaterialEdit(null)}
        />
      )}
      {details && (
        <SubmissionDetails
          record={details}
          onClose={() => {
            const target = editTriggerRef.current ?? sectionRef.current

            setDetails(null)
            target?.focus({ preventScroll: true })
          }}
        />
      )}
    </section>
  )
}
