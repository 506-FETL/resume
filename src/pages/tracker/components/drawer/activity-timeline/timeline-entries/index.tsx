import type { useActivityTimeline } from '../use-activity-timeline'
import type { TrackerActivityType } from '../../../../types'
import dayjs from 'dayjs'
import {
  Check,
  CircleDot,
  GitCommitHorizontal,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { PresenceListItem } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { resumeHtmlToText } from '@/lib/resume-import/text'
import { APPLICATION_STATUS_CONFIG } from '../../../../const'

const TYPE_ICON: Record<TrackerActivityType, typeof CircleDot> = {
  status_change: GitCommitHorizontal,
  workflow_resume: GitCommitHorizontal,
  interview: CircleDot,
  follow_up: CircleDot,
  note: MessageSquarePlus,
}

export function TimelineEntries({
  model,
}: {
  model: ReturnType<typeof useActivityTimeline>
}) {
  const {
    reduce,
    saving,
    setPendingDeleteActivity,
    setDeleteOpen,
    editingId,
    editDraft,
    setEditDraft,
    selectMode,
    selectedIds,
    deleteTriggerRef,
    deletingConfirmedRef,
    sorted,
    layoutKey,
    startEdit,
    cancelEdit,
    handleEditSave,
    toggleSelected,
  } = model

  return (
    <ol
      aria-label='跟进时间线'
      className='relative flex flex-col gap-0.5 px-1 pr-2'
    >
      <AnimatePresence initial={false} mode='popLayout'>
        {sorted.map((activity, index) => {
          const Icon = TYPE_ICON[activity.type] ?? CircleDot
          const isAuto = activity.type === 'status_change'
          const isChecked = selectedIds.has(activity.id)

          return (
            <PresenceListItem
              key={activity.id}
              layout={reduce ? false : 'position'}
              layoutDependency={`${layoutKey}-${selectMode}-${editingId}`}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{
                opacity: 0,
                transition: {
                  duration: reduce ? 0 : DURATION.fast,
                  delay: 0,
                  ease: EASE.in,
                },
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: DURATION.base,
                      delay: Math.min(index, 8) * 0.03,
                      ease: EASE.out,
                      layout: SPRING.layout,
                    }
              }
              className={cn(
                'group flex gap-3',
                selectMode &&
                  'cursor-pointer rounded-md -mx-1 px-1 hover:bg-muted/40',
              )}
              onClick={
                selectMode && !saving
                  ? () => toggleSelected(activity.id)
                  : undefined
              }
            >
              {selectMode && (
                <div className='flex h-8 shrink-0 items-center self-start'>
                  <Checkbox
                    checked={isChecked}
                    disabled={saving}
                    aria-label={`选择记录：${activity.label}`}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={() => toggleSelected(activity.id)}
                  />
                </div>
              )}
              <div className='flex flex-col items-center'>
                <span
                  className={cn(
                    'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border',
                    isAuto
                      ? 'border-primary/30 bg-primary/5 text-primary'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  <Icon className='size-3' />
                </span>
                <span className='w-px flex-1 bg-border group-last:hidden' />
              </div>
              <div className='flex min-w-0 flex-1 items-start justify-between gap-2 pb-4'>
                {editingId === activity.id && !selectMode ? (
                  <div className='flex flex-1 items-center gap-2'>
                    <Input
                      autoFocus
                      value={editDraft}
                      className='h-8'
                      disabled={saving}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                          handleEditSave()
                        else if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label='保存修改'
                      disabled={saving || !editDraft.trim()}
                      onClick={handleEditSave}
                    >
                      <Check className='size-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label='取消编辑'
                      disabled={saving}
                      onClick={cancelEdit}
                    >
                      <X className='size-3.5' />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm leading-snug break-words'>
                        {activity.label}
                      </p>
                      {activity.note && (
                        <p className='mt-0.5 text-xs text-muted-foreground break-words'>
                          {activity.note}
                        </p>
                      )}
                      {activity.resume_details && (
                        <div className='mt-1 space-y-1 text-xs text-muted-foreground'>
                          <p>
                            {activity.resume_details.date} · 恢复到
                            {
                              APPLICATION_STATUS_CONFIG[
                                activity.resume_details.target
                              ].label
                            }
                          </p>
                          {activity.resume_details.ended_detail && (
                            <p>
                              上次结束：
                              {activity.resume_details.ended_detail
                                .start_date ?? '日期未知'}
                              {activity.resume_details.ended_detail.notes
                                ? ` · ${resumeHtmlToText(activity.resume_details.ended_detail.notes)}`
                                : ''}
                            </p>
                          )}
                        </div>
                      )}
                      <p className='mt-0.5 text-[11px] text-muted-foreground'>
                        {dayjs(activity.at).format('YYYY-MM-DD HH:mm')}
                      </p>
                    </div>
                    {!selectMode && (
                      <div
                        className='ml-auto flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'
                        style={{
                          transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
                          transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
                        }}
                      >
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          aria-label='编辑记录'
                          disabled={saving}
                          onClick={() => startEdit(activity)}
                        >
                          <Pencil className='size-3.5' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          aria-label='删除记录'
                          disabled={saving}
                          onClick={(event) => {
                            deleteTriggerRef.current = event.currentTarget
                            deletingConfirmedRef.current = false
                            setPendingDeleteActivity(activity)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </PresenceListItem>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}
