import { useSubmissionList } from './use-submission-list'
import { RecordFacts } from './record-facts'
import { RecordJd } from './record-jd'
import type { JobSubmission } from '../../../submission-types'
import { ChevronDown, Pencil } from 'lucide-react'
import { DURATION } from '@/lib/motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ContentSkeleton } from '@/components/loading-skeleton'
import useTrackerStore from '../../../store'
import { SubmissionForm } from '../submission-dialog'
import SubmissionDetails from '../submission-details'
import SubmissionFileRow from '../submission-file-row'
import MaterialPreview from '../submission-preview'

export default function SubmissionList({
  jobId,
  onViewDetails,
}: {
  jobId: string
  onViewDetails?: () => void
}) {
  const {
    reduce,
    resource,
    sectionRef,
    editTriggerRef,
    historyTriggerRef,
    legacyTriggerRef,
    viewing,
    setViewing,
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
  } = useSubmissionList(jobId, onViewDetails)

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
          current?.error
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
        {current?.error ? (
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
          <ContentSkeleton
            label={compact ? '正在读取投递原件' : '正在加载投递详情'}
            className='p-0'
            rows={compact ? 1 : 2}
          />
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
                key={`${primary.id}-${resource?.revision ?? 0}`}
                recordId={primary.id}
              />
              <Collapsible
                open={historyOpen}
                onOpenChange={(next) => {
                  if (!next)
                    historyTriggerRef.current?.focus({ preventScroll: true })

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
                    更正历史{history ? `（${history.length}）` : ''}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent
                  inert={!historyOpen}
                  aria-hidden={!historyOpen || undefined}
                  className='motion-reduce:animate-none'
                >
                  <AnimatedContent
                    animationKey={
                      historyError ? 'error' : history ? 'ready' : 'loading'
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
                            historyTriggerRef.current?.focus({
                              preventScroll: true,
                            })

                            useTrackerStore
                              .getState()
                              .loadSubmissionHistory(primary.id)
                          }}
                        >
                          重试
                        </Button>
                      </Alert>
                    ) : !history ? (
                      <ContentSkeleton
                        label='正在读取更正历史'
                        className='px-2.5 py-2'
                        rows={2}
                      />
                    ) : history.length === 0 ? (
                      <p className='px-2.5 py-2 text-sm text-muted-foreground'>
                        暂无更正记录
                      </p>
                    ) : (
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
                    )}
                  </AnimatedContent>
                </CollapsibleContent>
              </Collapsible>
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
          {primary && (
            <Button
              size='sm'
              variant='outline'
              className='mt-2 w-fit'
              disabled={busy}
              onClick={() => choose(primary)}
            >
              重新读取职位
            </Button>
          )}
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
